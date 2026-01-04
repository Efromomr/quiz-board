type Question = {
  id: number;
  text: string;
  options: string[];
};

export default function QuestionModal({
  open,
  data,
  onAnswer
}: {
  open: boolean;
  data: {
    fieldType: "BOOST" | "TRAP";
    value: number;
    question: Question;
  } | null;
  onAnswer: (answerIndex: number) => void;
}) {
  if (!open || !data) return null;

  const { fieldType, value, question } = data;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <div
        style={{
          background: "white",
          padding: 24,
          maxWidth: 400,
          width: "100%"
        }}
      >
        <h3>
          {fieldType === "BOOST"
            ? `Correct → move +${value}`
            : `Wrong → move -${value}`}
        </h3>

        <p>{question.text}</p>

        {question.options.map((opt, i) => (
          <button
            key={i}
            style={{
              display: "block",
              width: "100%",
              marginBottom: 8
            }}
            onClick={() => onAnswer(i)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
