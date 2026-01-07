import { useState } from "react";

type Props = {
  gameId: string | null;
  onCreate: (gameId: string) => void;
  onJoin: (gameId: string) => void;
  onEnterLobby: () => void;
  onSetName: (name: string) => void;
};

export default function Home({
  gameId,
  onCreate,
  onJoin,
  onEnterLobby,
  onSetName
}: Props) {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");

  async function createGame() {
    if (!name) {
      setError("Please enter your name");
      return;
    }

    onSetName(name);
    setError("");

    const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/create-game`, {
      method: "POST"
    });

    const data = await res.json();
    onCreate(data.gameId);
  }

  function joinGame() {
    if (!name || !joinCode) {
      setError("Enter name and game code");
      return;
    }

    onSetName(name);
    onJoin(joinCode.toUpperCase());
  }

  return (
    <div className="home-container">
      <h1>Quiz Board Game</h1>
	  

      <input
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {!gameId && (
        <>
          <button onClick={createGame}>🎲 Create Game</button>

          <hr />

          <input
            placeholder="Game Code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />

          <button onClick={joinGame}>➕ Join Game</button>
        </>
      )}

      {gameId && (
        <>
          <h3>Game Created!</h3>
          <p>
            Share this code with players:
            <br />
            <strong style={{ fontSize: 24 }}>{gameId}</strong>
          </p>

          <button onClick={onEnterLobby}>➡ Enter Lobby</button>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
