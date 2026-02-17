
import React from 'react';
import { LANGUAGES } from '../types';

interface Props {
  value: string;
  onChange: (val: string) => void;
}

const LanguageSelector: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-slate-700">Explanation Language</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;
