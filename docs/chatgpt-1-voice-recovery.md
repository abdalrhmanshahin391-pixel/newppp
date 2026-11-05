# ChatGPT-1: voice connection recovery

This branch starts at e8846fd (main, PR #122). Keep it separate from Claude's branch;
it is not a production deployment.

## Evidence and scope

The iPad screenshots show an opening-handshake timeout alongside a misleading
ready/listening label. The pinned Pipecat 0.0.105 Cartesia adapter catches socket
opening failures and emits the exact generic error prefix shown in the screenshot:
https://github.com/pipecat-ai/pipecat/blob/v0.0.105/src/pipecat/services/cartesia/tts.py

The application's onError previously displayed that message but left the microphone,
active flag and bot-ready flag unchanged. The study-column label also treated
transport-connected as listening, even before bot readiness.

This identifies a matching failure path, not the network conditions of the photographed
session. No production provider logs or real paid call were available in this run.

## Changes

- Named connection phases for waiting, readiness, failure and end.
- Every SDK callback is scoped to its own attempt; retired attempts cannot set readiness,
  append transcripts, attach audio tracks or change the next attempt's state.
- Failure retires the attempt immediately, disables the microphone, clears the study
  sender and cancels the readiness timer. Audio is detached and remote sessions are closed.
- Cleanup uses captured session IDs, bounds waiting to five seconds, and keeps the chat,
  draft and guide position for manual reconnection.
- Late successful startup responses are closed rather than adopted by the next call.
- The UI shows Arabic actionable errors and a reconnect action instead of internal legacy
  architecture wording. Waiting/failed states never announce that Rita is listening.
- Cartesia opening uses a 15-second handshake deadline and at most one retry for timeout
  or network OSError. Authentication errors and cancellation are not retried.
- Provider failures/retries record bounded provider-specific timing markers; raw
  credential-bearing connection exceptions are not forwarded to the browser.

## Validation and integration

New tests cover old callbacks after failure/retry, status labels, sanitized error messages,
bounded provider retry, authentication rejection, cancellation and the Cartesia adapter.
Existing startup and transcript tests remain in use. Frontend CI includes the new tests,
type checking and production build; worker CI runs the adapter and retry tests.

To release this work later, review/merge it with Claude's branch, then publish the frontend
and deploy the voice worker from the same reviewed revision. The existing worker deployment
workflow runs when voice-agent changes reach main. No database migration or new secret is
required. Validate one real iPad call and a failed/retried call before calling the live
incident resolved.
