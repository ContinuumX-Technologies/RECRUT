import React from "react";

type Props = {
    output: string;
  };
  
  export default function TestcaseConsole({ output }: Props) {
    return (
      <div className="console">
        {output || "Run code to see output"}
      </div>
    );
  }
