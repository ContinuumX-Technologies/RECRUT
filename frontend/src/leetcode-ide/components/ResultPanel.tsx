import React from "react";

type Result = {
    status: string;
    time: string;
    memory: string;
  };
  
  export default function ResultPanel({ result }: { result: Result | null }) {
    if (!result) return null;
  
    return (
      <div className="result">
        <p>Status: <b>{result.status}</b></p>
        <p>Time: {result.time}</p>
        <p>Memory: {result.memory}</p>
      </div>
    );
  }
