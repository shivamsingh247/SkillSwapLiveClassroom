import React from "react";
import { createRoot } from "react-dom/client";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer
} from "@livekit/components-react";
import "@livekit/components-styles";
import "./style.css";

function App() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get("token");
  const serverUrl = params.get("server_url");
  const roomName = params.get("room_name");

  if (!token || !serverUrl || !roomName) {
    return (
      <main className="waiting">
        <h1>SkillSwap Live Classroom</h1>
        <p>Open this classroom from your SkillSwap app.</p>
        <p>Your secure classroom access token is required.</p>
      </main>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      video={true}
      audio={true}
      onDisconnected={() => {
        window.location.hash = "";
      }}
      data-lk-theme="default"
      style={{ height: "100dvh" }}
    >
      <VideoConference />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

createRoot(document.getElementById("root")).render(<App />);
