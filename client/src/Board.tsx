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
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(10, 50px)",
        gap: 4,
        marginTop: 20
      }}
    >
      {board.map((field) => {
        const playersHere = players.filter(
          (p) => p.position === field.index
        );

        let bg = "#eee";
        if (field.type === "BOOST") bg = "#b6fcb6";
        if (field.type === "TRAP") bg = "#fcb6b6";

        return (
          <div
            key={field.index}
            style={{
              width: 50,
              height: 50,
              background: bg,
              border: "1px solid #999",
              fontSize: 10,
              position: "relative",
              padding: 2
            }}
          >
            <div>{field.index}</div>

            <div
              style={{
                position: "absolute",
                bottom: 2,
                left: 2,
                right: 2,
                display: "flex",
                gap: 2,
                flexWrap: "wrap"
              }}
            >
              {playersHere.map((p) => (
                <div
                  key={p.id}
                  title={p.name}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "blue"
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
