import Editor from "@monaco-editor/react";
import { useState } from "react";
import { runCode, submitCode } from "../services/judgeApi";

type Props = {
  questionId: string;
  language: "javascript" | "python";
  value: string;
  onChange: (val: string) => void;
};

export default function EmbeddedIDE({
  questionId,
  language,
  value,
  onChange
}: Props) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!value.trim()) return;

    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await runCode({
        questionId,
        language,
        code: value
      });

      setResult(res.data);
    } catch (e: any) {
      setError(e?.message || "Execution failed");
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!value.trim()) return;

    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await submitCode({
        questionId,
        language,
        code: value
      });

      setResult(res.data);
    } catch (e: any) {
      setError(e?.message || "Submission failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 overflow-hidden">
      {/* ================= Toolbar ================= */}
      <div className="flex justify-between items-center px-3 py-2 bg-slate-900 border-b border-slate-700">
        <span className="text-xs text-slate-400">
          Language: {language.toUpperCase()}
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleRun}
            disabled={running}
            className="px-3 py-1.5 text-xs rounded bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50"
          >
            {running ? "Running..." : "Run"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={running}
            className="px-3 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
          >
            {running ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>

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
            automaticLayout: true
          }}
        />
      </div>

      {/* ================= Result Panel ================= */}
      {(result || error) && (
        <div className="border-t border-slate-700 bg-black p-3 text-xs text-slate-200 max-h-56 overflow-auto">
          {/* RUN RESULTS */}
          {result?.testResults && (
            <>
              <p className="font-semibold mb-2">Test Case Results</p>
              {result.testResults.map((t: any, i: number) => (
                <div
                  key={i}
                  className={`mb-2 p-2 rounded ${
                    t.passed ? "bg-green-900/30" : "bg-red-900/30"
                  }`}
                >
                  <div><strong>Input:</strong> {t.input}</div>
                  <div><strong>Expected:</strong> {t.expected}</div>
                  <div><strong>Actual:</strong> {t.actual}</div>
                  {t.timeMs !== undefined && (
                    <div><strong>Time:</strong> {t.timeMs} ms</div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* SUBMIT RESULT */}
          {result?.status && (
            <div className="space-y-1">
              <p className="font-semibold">
                Verdict:{" "}
                <span
                  className={
                    result.status === "Accepted"
                      ? "text-emerald-400"
                      : "text-red-400"
                  }
                >
                  {result.status}
                </span>
              </p>
              {result.timeMs && <p>Time: {result.timeMs} ms</p>}
              {result.memoryMb && <p>Memory: {result.memoryMb} MB</p>}
            </div>
          )}

          {/* ERROR */}
          {error && <p className="text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
