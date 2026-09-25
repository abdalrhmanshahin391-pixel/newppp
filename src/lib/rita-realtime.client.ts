/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAI's event union is decoded at runtime. */
// Browser-side WebRTC media only. The standard API key stays on our server.
export type RitaRealtimeController = {
  mute(value: boolean): void;
  sendText(value: string): void;
  play(): Promise<void>;
  stop(): void;
};

type Events = {
  onSpeechStart(): void;
  onSpeechEnd(): void;
  onTranscript(text: string): void;
  onReply(text: string): void;
  onSpeaking(): void;
  onListening(): void;
  onPlaybackBlocked(): void;
  onUsage(response: Record<string, unknown>): void;
  onError(message: string): void;
  onEnded(message: string): void;
};

const MODEL = "gpt-realtime-2.1-mini";

export async function startRitaRealtime(
  token: string,
  sessionId: string,
  callbacks: Events,
): Promise<RitaRealtimeController> {
  const peer = new RTCPeerConnection();
  const playback = document.createElement("audio");
  playback.autoplay = true;
  playback.setAttribute("playsinline", "true");
  playback.style.display = "none";
  document.body.append(playback);
  let stream: MediaStream | null = null;
  let closed = false;
  let ready = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let responseText = "";
  let lastReply = "";
  const events = peer.createDataChannel("oai-events");

  const stop = () => {
    if (closed) return;
    closed = true;
    if (timer) clearTimeout(timer);
    stream?.getTracks().forEach((track) => track.stop());
    events.close();
    peer.close();
    playback.pause();
    playback.srcObject = null;
    playback.remove();
  };

  try {
    peer.ontrack = ({ streams, track }) => {
      playback.srcObject = streams[0] || new MediaStream([track]);
      void playback.play().catch(() => callbacks.onPlaybackBlocked());
    };
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);
    const connected = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Realtime connection timed out.")), 28_000);
      events.onmessage = ({ data }) => {
        let event: Record<string, any>;
        try {
          event = JSON.parse(String(data));
        } catch {
          return;
        }
        switch (event.type) {
          case "session.created":
            if (event.session?.model !== MODEL) {
              reject(new Error("OpenAI connected a different voice model. Pilot stopped."));
              break;
            }
            if (!ready) {
              ready = true;
              clearTimeout(timeout);
              resolve();
            }
            break;
          case "session.updated":
            if (event.session?.model && event.session.model !== MODEL) {
              callbacks.onError("Voice model changed unexpectedly. End this lesson.");
              stop();
              callbacks.onEnded("Voice model changed unexpectedly.");
            }
            break;
          case "input_audio_buffer.speech_started":
            callbacks.onSpeechStart();
            break;
          case "input_audio_buffer.speech_stopped":
            callbacks.onSpeechEnd();
            break;
          case "conversation.item.input_audio_transcription.completed":
            if (typeof event.transcript === "string") callbacks.onTranscript(event.transcript);
            break;
          case "response.created":
            responseText = "";
            callbacks.onSpeaking();
            break;
          case "response.output_audio_transcript.delta":
            responseText += String(event.delta ?? "");
            break;
          case "response.output_audio_transcript.done":
            responseText = String(event.transcript || responseText);
            if (responseText.trim() && responseText.trim() !== lastReply) {
              lastReply = responseText.trim();
              callbacks.onReply(lastReply);
            }
            break;
          case "response.done":
            if (responseText.trim() && responseText.trim() !== lastReply) {
              lastReply = responseText.trim();
              callbacks.onReply(lastReply);
            }
            callbacks.onListening();
            if (event.response?.id && event.response?.usage) callbacks.onUsage(event.response);
            break;
          case "error":
            if (!ready) reject(new Error(String(event.error?.message || "Realtime voice error.")));
            else callbacks.onError(String(event.error?.message || "Realtime voice error."));
            break;
        }
      };
      events.onclose = () => {
        if (!closed) {
          if (!ready) reject(new Error("Realtime voice disconnected before connecting."));
          stop();
          callbacks.onEnded("Realtime voice disconnected.");
        }
      };
    });
    void connected.catch(() => undefined); // A failed SDP request can settle before this is awaited.
    peer.onconnectionstatechange = () => {
      if (!closed && (peer.connectionState === "failed" || peer.connectionState === "closed")) {
        stop();
        callbacks.onEnded("Realtime voice connection ended.");
      }
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const response = await fetch("/api/rita/live", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/sdp",
        "X-Rita-Session": sessionId,
      },
      body: peer.localDescription?.sdp || offer.sdp || "",
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(String(result?.error || "Could not connect Rita Realtime."));
    }
    if (response.headers.get("X-Rita-Model") !== MODEL)
      throw new Error("Realtime model confirmation missing. Pilot stopped.");
    await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
    await connected;
    timer = setTimeout(() => {
      stop();
      callbacks.onEnded("Five-minute pilot call ended. Start a new lesson to continue.");
    }, 5 * 60_000);
    return {
      mute(value) {
        stream?.getAudioTracks().forEach((track) => {
          track.enabled = !value;
        });
      },
      sendText(value) {
        if (events.readyState !== "open") throw new Error("Realtime voice is disconnected.");
        events.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: { type: "message", role: "user", content: [{ type: "input_text", text: value }] },
          }),
        );
        events.send(JSON.stringify({ type: "response.create" }));
      },
      play: () => playback.play(),
      stop,
    };
  } catch (error) {
    stop();
    throw error;
  }
}
