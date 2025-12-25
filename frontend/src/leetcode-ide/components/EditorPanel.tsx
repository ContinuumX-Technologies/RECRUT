import React from "react";
import Editor from "@monaco-editor/react";

type Props = {
  language: string;
  code: string;
  setCode: (value: string) => void;
};

export default function EditorPanel({ language, code, setCode }: Props) {
  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={language}
      value={code}
      onChange={(v) => setCode(v || "")}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        automaticLayout: true
      }}
    />
  );
}
