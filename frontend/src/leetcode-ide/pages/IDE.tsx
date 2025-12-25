import React,{ useState } from "react";
import "../styles/ide.css";
import EditorPanel from "../components/EditorPanel";
import LanguageSelector from "../components/LanguageSelector";
import ProblemPanel from "../components/ProblemPanel";
import TestcaseConsole from "../components/TestcaseConsole";
import ResultPanel from "../components/ResultPanel";
import { DEFAULT_CODE } from "../constants/languages";
import { runCode, submitCode } from "../services/judgeApi";

export default function IDE() {
  const [lang, setLang] = useState("cpp");
  const [code, setCode] = useState(DEFAULT_CODE.cpp);
  const [output, setOutput] = useState("");
  const [result, setResult] = useState(null);

  return (
    <div className="ide-root">
      <ProblemPanel />

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div className="toolbar">
          <LanguageSelector lang={lang} setLang={setLang} />
          <div>
            <button onClick={async () => {
              const res = await runCode({ code, lang });
              setOutput(res.data.output);
            }}>
              Run
            </button>

            <button className="submit" onClick={async () => {
              const res = await submitCode({ code, lang });
              setResult(res.data);
            }}>
              Submit
            </button>
          </div>
        </div>

        <div className="editor-wrapper">
          <EditorPanel
            language={lang}
            code={code}
            setCode={setCode}
          />
        </div>

        <TestcaseConsole output={output} />
        <ResultPanel result={result} />
      </div>
    </div>
  );
}
