"""Turn router: decide what a finished learner turn needs before the model runs.

Most turns go straight to the language model. A few short ones do not need it, and
sending them there is what produced the bad replies: "خلص" read as "summarise" (Rita
re-explained), a bare "إيه" after "نكمل ولا نغيّر الموضوع؟" read as "continue", and
"أمم…" answered as if it were a request.

The router sits between the user aggregator and the model. For each finished turn it:

- "stop": Rita says one short, human acknowledgement and goes quiet. No model call.
- "hold": the learner is only thinking ("أمم…", "استنى"). Rita says nothing and waits.
- "speak": a bare "yes" to a question that offered options. Rita asks "أي واحد: …؟".
- "ui": a first hello (scripted greeting) or a spoken command for the words list ("افتحي القائمة", "حوليهم فلاش كارد"). The page
  does the work; Rita says one short line and the model is not asked.
- "pass": everything else goes to the model, with a short note about what the learner's
  turn meant (see RitaSessionState.dialogue_state).

Modes (env RITA_ROUTER_MODE): `on` (default), `shadow` (decide and log only, never change
what happens), `off` (pass-through). Any error inside the router lets the turn through
unchanged, so a router bug can never leave Rita silent.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from enum import StrEnum
from typing import Callable

from loguru import logger
from pipecat.frames.frames import Frame, LLMContextFrame, TTSSpeakFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.processors.frameworks.rtvi import RTVIServerMessageFrame

from rita_dialogue_acts import Act, Awaiting, Question, Reading, classify, clarify_choice
from rita_dialect import greeting_for, is_greeting
from rita_state import RitaSessionState
from rita_ui_commands import UiAction, UiCommand, read_ui_command


class RouterMode(StrEnum):
    ON = "on"
    SHADOW = "shadow"
    OFF = "off"


class Action(StrEnum):
    PASS = "pass"
    STOP = "stop"
    HOLD = "hold"
    SPEAK = "speak"
    UI = "ui"


def router_mode() -> RouterMode:
    raw = os.getenv("RITA_ROUTER_MODE", "on").strip().casefold()
    try:
        return RouterMode(raw)
    except ValueError:
        return RouterMode.ON


def stop_ack_enabled() -> bool:
    return os.getenv("RITA_STOP_ACK", "say").strip().casefold() != "silent"


# One neutral acknowledgement: repeated stop commands must not restart or elaborate.
ACKS = {
    "ar": ("تمام.",),
    "en": ("Okay.",),
    "de": ("Okay.",),
}

# After this many unanswered "which one?" questions, stop asking and let the model pick.
MAX_CLARIFICATIONS = 2


# What Rita says after a list command. The page shows the real result on screen.
UI_SAYS = {
    "open": {"ar": "تفضل.", "en": "Here it is.", "de": "Bitte."},
    "choose": {
        "ar": "اختار الموضوع من الشاشة.",
        "en": "Choose the subject on the screen.",
        "de": "Wähl das Thema auf dem Bildschirm.",
    },
    "done": {"ar": "تمام، شوف الشاشة.", "en": "Okay, check the screen.", "de": "Okay, schau auf den Bildschirm."},
    "empty": {
        "ar": "القائمة لسا فاضية.",
        "en": "The list is still empty.",
        "de": "Die Liste ist noch leer.",
    },
}


@dataclass(frozen=True)
class Decision:
    action: Action
    reading: Reading
    say: str | None = None
    command: UiCommand | None = None


def decide(text: str, state: RitaSessionState, *, language: str, ack: bool = True) -> Decision:
    """Pure decision for one finished learner turn (the state is read, never changed)."""

    reading = classify(text, awaiting=state.awaiting)
    act = reading.act
    lang = language if language in ACKS else "ar"

    # A plain hello as the very first turn gets a vetted greeting (and no model call).
    if (
        is_greeting(text)
        and not state.greeted
        and state.assistant_turns == 0
        and len(state.recent_user_turns) <= 1
    ):
        return Decision(Action.UI, reading, greeting_for(text, lang))

    command = read_ui_command(text)
    if command is not None:
        # A count of 0 is known-empty; None means the page has not said, so act anyway.
        empty = state.learning_count == 0
        if command.action == UiAction.OPEN_LIST:
            return Decision(Action.UI, reading, UI_SAYS["open"][lang], command)
        if empty:
            return Decision(Action.UI, reading, UI_SAYS["empty"][lang])  # nothing to send
        key = "done" if command.hint else "choose"
        return Decision(Action.UI, reading, UI_SAYS[key][lang], command)

    if act == Act.STOP:
        phrases = ACKS[lang]
        # The state has already counted this stop when the router prepared the turn.
        say = phrases[max(state.stop_count - 1, 0) % len(phrases)] if ack else None
        return Decision(Action.STOP, reading, say)
    if act in (Act.HESITATION, Act.WAIT):
        return Decision(Action.HOLD, reading)
    if (
        act == Act.YES
        and state.awaiting == Awaiting.CHOICE
        and len(state.options) >= 2
        and state.clarification_count < MAX_CLARIFICATIONS
    ):
        question = Question(state.last_question, Awaiting.CHOICE, state.options)
        return Decision(Action.SPEAK, reading, clarify_choice(question, lang))
    return Decision(Action.PASS, reading)


def last_user_text(frame: LLMContextFrame) -> str | None:
    messages = frame.context.get_messages()
    if not messages:
        return None
    last = messages[-1]
    if last.get("role") != "user":
        return None
    content = last.get("content")
    return content if isinstance(content, str) else None


class RitaTurnRouter(FrameProcessor):
    """Pipecat processor: place it between the user aggregator and the LLM service."""

    def __init__(
        self,
        *,
        state: RitaSessionState,
        prepare_turn: Callable[[str], None],
        language_of_turn: Callable[[], str],
        mode: RouterMode | None = None,
        ack: bool | None = None,
        session_id: str = "",
        trace_id: str = "",
        turn_id: Callable[[], int] | None = None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self._state = state
        self._prepare_turn = prepare_turn
        self._language_of_turn = language_of_turn
        self.mode = mode or router_mode()
        self._ack = stop_ack_enabled() if ack is None else ack
        self._session_id = session_id
        self._trace_id = trace_id
        self._turn_id = turn_id or (lambda: 0)
        # The user aggregator normally sends every committed context here once. A
        # confirmed interruption can race the final transcript in Pipecat 0.0.105;
        # bot.py uses this monotonic marker to retry only a context that never
        # reached the router, without duplicating an ordinary model call.
        self.last_routed_context_size = 0
        #: what the router did with the last committed turn (pass, speak, stop, hold, ui)
        self.last_action: str | None = None

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if (
            direction != FrameDirection.DOWNSTREAM
            or not isinstance(frame, LLMContextFrame)
            or self.mode == RouterMode.OFF
        ):
            await self.push_frame(frame, direction)
            return
        text: str | None = None
        prepared = False
        try:
            text = last_user_text(frame)
            if text is None:
                await self.push_frame(frame, direction)
                return
            self.last_routed_context_size = len(frame.context.get_messages())
            if self.mode == RouterMode.ON:
                # One place updates the state and the system prompt, before the model reads it.
                self._prepare_turn(text)
                prepared = True
            decision = decide(
                text, self._state, language=self._language_of_turn(), ack=self._ack
            )
            self.last_action = decision.action.value
        except Exception as error:  # a router bug must never silence Rita
            logger.bind(error=repr(error)).warning("Rita router failed; passing the turn through")
            if self.mode == RouterMode.ON and text is not None and not prepared:
                try:
                    self._prepare_turn(text)
                except Exception as inner:
                    logger.bind(error=repr(inner)).warning("Rita could not prepare the turn")
            await self.push_frame(frame, direction)
            return

        logger.bind(
            session_id=self._session_id or None,
            trace_id=self._trace_id or None,
            turn_id=self._turn_id() or None,
            mode=self.mode.value,
            action=decision.action.value,
            reading=str(decision.reading),
            awaiting=self._state.awaiting.value,
            word_count=len(text.split()),
            character_count=len(text),
        ).info("Rita router decision")

        if self.mode == RouterMode.ON and decision.reading.act in {
            Act.COMPLAINT,
            Act.SIMPLIFY,
            Act.CORRECTION,
        }:
            # Privacy-safe product evidence: classification only, never transcript text.
            await self.push_frame(
                RTVIServerMessageFrame(
                    data={
                        "type": "rita-dialogue-act",
                        "act": decision.reading.act.value,
                        "action": decision.action.value,
                        "wordCount": len(text.split()),
                    }
                )
            )

        if self.mode == RouterMode.SHADOW or decision.action == Action.PASS:
            await self.push_frame(frame, direction)
            return
        if decision.action == Action.SPEAK:
            self._state.clarification_count += 1
        if decision.action == Action.UI and decision.command is None and is_greeting(text):
            self._state.greeted = True
        if decision.action == Action.UI and decision.command is not None:
            # The page opens the list or saves the words; it reports the real result on screen.
            await self.push_frame(
                RTVIServerMessageFrame(
                    data={
                        "type": "rita-ui",
                        "action": decision.command.action.value,
                        "target": decision.command.target,
                        "hint": decision.command.hint,
                    }
                )
            )
        if decision.say:
            # TTSSpeakFrame bypasses the LLM text callbacks. Tell the page the
            # exact intended line so audio and chat remain one atomic response.
            await self.push_frame(
                RTVIServerMessageFrame(
                    data={"type": "rita-spoken-text", "text": decision.say}
                )
            )
            await self.push_frame(TTSSpeakFrame(decision.say, append_to_context=True))
        # STOP, HOLD, SPEAK and UI never reach the model.
