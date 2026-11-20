import React, { useEffect, useState } from "react";
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
  const authToken = params.get("auth_token");
  const apiUrl = params.get("api_url");
  const role = params.get("role");

  // Remove sensitive tokens from the visible URL immediately.
  window.history.replaceState(null, "", window.location.pathname + window.location.search);

  const [controls, setControls] = useState(null);
  const [controlStatus, setControlStatus] = useState("");

  useEffect(() => {
    if (role !== "teacher" || !authToken || !apiUrl || !roomName) return;

    fetch(`${apiUrl}/classrooms/${encodeURIComponent(roomName)}/controls`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
      .then(async response => {
        if (!response.ok) throw new Error("Could not load classroom controls");
        return response.json();
      })
      .then(data => setControls(data.controls))
      .catch(error => setControlStatus(error.message));
  }, [role, authToken, apiUrl, roomName]);

  async function updateControl(key, value) {
    const updated = { ...controls, [key]: value };
    setControls(updated);
    setControlStatus("Saving...");
    try {
      const response = await fetch(
        `${apiUrl}/classrooms/${encodeURIComponent(roomName)}/controls`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ [key]: value })
        }
      );
      if (!response.ok) throw new Error("Could not save this setting");
      setControlStatus("Controls saved. Rejoining participants may be required for permission changes.");
    } catch (error) {
      setControls(controls);
      setControlStatus(error.message);
    }
  }

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
      onDisconnected={() => { window.location.replace(window.location.pathname); }}
      data-lk-theme="default"
      style={{ height: "100dvh" }}
    >
      {role === "teacher" && (
        <section className="teacher-controls">
          <strong>Teacher Controls</strong>
          {controls ? (
            <div className="control-options">
              {[
                ["learner_video_enabled", "Learner camera"],
                ["learner_audio_enabled", "Learner microphone"],
                ["screen_sharing_enabled", "Screen sharing"],
                ["learner_chat_enabled", "In-class chat"]
              ].map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={Boolean(controls[key])}
                    onChange={event => updateControl(key, event.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
          ) : <span>Loading controls...</span>}
          {controlStatus && <small>{controlStatus}</small>}
        </section>
      )}
      <VideoConference />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

createRoot(document.getElementById("root")).render(<App />);
