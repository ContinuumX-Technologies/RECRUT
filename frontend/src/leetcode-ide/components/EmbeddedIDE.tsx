import Editor from "@monaco-editor/react";

type Props = {
  questionId: string;
  language: "javascript" | "python";
  value: string;
  onChange: (val: string) => void;
  // FIX: Added testCases prop to match the new API requirement
  testCases: { input: string; output: string }[];
};

export default function EmbeddedIDE({ language, value, onChange }: Props) {


  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">

      {/* ================= Editor ================= */}
      <div style={{ height: "360px" }}>
      <Editor
          theme="vs-dark"
          language={language}
          value={value}
          onChange={(v) => onChange(v || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
