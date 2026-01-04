import { useState } from "react";
import Home from "./Home";
import Lobby from "./Lobby";

export default function App() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);

  if (!gameId || !ready) {
    return (
      <Home
        gameId={gameId}
        onCreate={(id) => {
          setGameId(id);
          setReady(false);
        }}
        onEnterLobby={() => setReady(true)}
        onJoin={(id) => {
          setGameId(id);
          setReady(true);
        }}
        onSetName={setName}
      />
    );
  }

  return <Lobby gameId={gameId} name={name} />;
}
