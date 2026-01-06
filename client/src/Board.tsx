type Player = {
  id: string;
  name: string;
  position: number;
};

type BoardField = {
  index: number;
  type: "NORMAL" | "BOOST" | "TRAP";
  value?: number;
};

export default function Board({
  board,
  players
}: {
  board: BoardField[];
  players: Player[];
}) {
  // Helper function to get player color class based on their index in the players array
  const getPlayerColorClass = (playerId: string): string => {
    const playerIndex = players.findIndex((p) => p.id === playerId);
    return `player-color-${playerIndex % 6}`;
  };

  return (
    <div className="board-container">
      {board.map((field) => {
        const playersHere = players.filter(
          (p) => p.position === field.index
        );

        const fieldClass = `board-field ${
          field.type === "BOOST"
            ? "boost"
            : field.type === "TRAP"
            ? "trap"
            : "normal"
        }`;

        return (
          <div key={field.index} className={fieldClass}>
            <div>{field.index}</div>

            <div className="players-on-field">
              {playersHere.map((p) => (
                <div
                  key={p.id}
                  title={p.name}
                  className={`player-token ${getPlayerColorClass(p.id)}`}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
