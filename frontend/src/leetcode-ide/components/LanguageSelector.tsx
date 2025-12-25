import React from "react";
import { LANGUAGES } from "../constants/languages";

type Props = {
  lang: string;
  setLang: (lang: string) => void;
};

export default function LanguageSelector({ lang, setLang }: Props) {
  return (
    <select value={lang} onChange={e => setLang(e.target.value)}>
      {LANGUAGES.map(l => (
        <option key={l.id} value={l.id}>{l.label}</option>
      ))}
    </select>
  );
}
