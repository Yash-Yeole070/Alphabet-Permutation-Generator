import React, { useState, useMemo } from 'react';
import {
  validateRegexSyntax,
  extractAlphabet,
  generateValidStrings,
  checkUserString,
  GeneratedStringItem,
  ValidationResult,
} from './engine/tocAutomata';
import { PWAInstallButton } from './pwa/PWAInstallButton';
import { OfflineIndicator } from './pwa/OfflineIndicator';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Search,
  BookOpen,
  Info,
  CornerDownRight,
} from 'lucide-react';

export default function App() {
  // Section 1: Regular Expression state
  const [regexInput, setRegexInput] = useState<string>('(a|b)*');
  const [regexError, setRegexError] = useState<string | null>(null);

  // Section 2: Generation state
  const [maxLengthInput, setMaxLengthInput] = useState<number | string>(2);
  const [generatedList, setGeneratedList] = useState<GeneratedStringItem[] | null>([
    { length: 0, value: 'ε', rawString: '' },
    { length: 1, value: 'a', rawString: 'a' },
    { length: 1, value: 'b', rawString: 'b' },
    { length: 2, value: 'aa', rawString: 'aa' },
    { length: 2, value: 'ab', rawString: 'ab' },
    { length: 2, value: 'ba', rawString: 'ba' },
    { length: 2, value: 'bb', rawString: 'bb' },
  ]);
  const [generationCount, setGenerationCount] = useState<number | null>(7);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Section 3: String Validation state
  const [userStringInput, setUserStringInput] = useState<string>('abba');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>({
    accepted: true,
    explanation: 'abba belongs to the language represented by (a|b)*.',
  });

  // Automatically derive alphabet from regular expression
  const derivedAlphabet = useMemo(() => {
    return extractAlphabet(regexInput);
  }, [regexInput]);

  // Handle Regex Change
  const handleRegexChange = (val: string) => {
    setRegexInput(val);
    if (!val.trim()) {
      setRegexError('Empty regular expression. Please enter a regular expression.');
      return;
    }
    const syntax = validateRegexSyntax(val);
    if (!syntax.valid) {
      setRegexError(syntax.error || 'Invalid regular expression.');
    } else {
      setRegexError(null);
    }
  };

  // Preset example click handler
  const loadPreset = (re: string, sampleStr?: string, maxL: number = 2) => {
    setRegexInput(re);
    setRegexError(null);
    setMaxLengthInput(maxL);
    if (sampleStr !== undefined) {
      setUserStringInput(sampleStr);
    }

    // Auto-generate for immediate feedback
    const gen = generateValidStrings(re, maxL);
    if (gen.success) {
      setGeneratedList(gen.strings);
      setGenerationCount(gen.totalCount);
      setGenerationError(null);
    } else {
      setGeneratedList(null);
      setGenerationCount(null);
      setGenerationError(gen.errorMessage || 'Generation failed.');
    }

    // Auto-validate sample string if present
    if (sampleStr !== undefined) {
      const valRes = checkUserString(re, sampleStr);
      setValidationResult(valRes);
    }
  };

  // Section 2: Generate Strings Handler
  const handleGenerateStrings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Validate regex first
    const syntax = validateRegexSyntax(regexInput);
    if (!syntax.valid) {
      setRegexError(syntax.error || 'Invalid regular expression.');
      setGenerationError(syntax.error || 'Invalid regular expression.');
      setGeneratedList(null);
      setGenerationCount(null);
      return;
    }
    setRegexError(null);

    // Validate max length
    if (maxLengthInput === '' || maxLengthInput === null || maxLengthInput === undefined) {
      setGenerationError('Please enter a maximum length L.');
      setGeneratedList(null);
      setGenerationCount(null);
      return;
    }

    const numL = Number(maxLengthInput);
    if (isNaN(numL)) {
      setGenerationError('Maximum length must be a valid number.');
      setGeneratedList(null);
      setGenerationCount(null);
      return;
    }

    if (numL < 0 || !Number.isInteger(numL)) {
      setGenerationError('Maximum length must be a non-negative integer (0 ≤ L ≤ 10).');
      setGeneratedList(null);
      setGenerationCount(null);
      return;
    }

    if (numL > 10) {
      setGenerationError('Maximum length cannot exceed 10.');
      setGeneratedList(null);
      setGenerationCount(null);
      return;
    }

    const result = generateValidStrings(regexInput, numL);
    if (result.success) {
      setGeneratedList(result.strings);
      setGenerationCount(result.totalCount);
      setGenerationError(null);
    } else {
      setGeneratedList(null);
      setGenerationCount(null);
      setGenerationError(result.errorMessage || 'Failed to generate strings.');
    }
  };

  // Section 3: Check String Handler
  const handleCheckString = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Validate regex first
    const syntax = validateRegexSyntax(regexInput);
    if (!syntax.valid) {
      setRegexError(syntax.error || 'Invalid regular expression.');
      setValidationResult({
        accepted: false,
        explanation: 'Cannot check string because the regular expression is invalid.',
        error: syntax.error,
      });
      return;
    }
    setRegexError(null);

    const result = checkUserString(regexInput, userStringInput);
    setValidationResult(result);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      <OfflineIndicator />

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-indigo-200">
              ∑*
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Alphabet Permutation Generator
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                Theory of Computation / Formal Language PBL Project
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PWAInstallButton />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* App Title & Short Description */}
        <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-2">
                <BookOpen className="w-3.5 h-3.5" />
                TOC Finite Automata Engine
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Alphabet Permutation Generator
              </h2>
              <p className="mt-1 text-sm sm:text-base text-slate-600 font-medium">
                Generate valid strings and check whether a string belongs to a regular language.
              </p>
            </div>
          </div>

          {/* Quick presets for examiners / students */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Quick Test Cases:
            </p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {[
                { re: '(a|b)*', str: 'abba', maxL: 2, label: '(a|b)*' },
                { re: 'a*', str: 'aaa', maxL: 4, label: 'a*' },
                { re: 'a|b', str: 'a', maxL: 2, label: 'a|b' },
                { re: 'ab', str: 'ab', maxL: 2, label: 'ab' },
                { re: 'a(b|c)', str: 'ab', maxL: 2, label: 'a(b|c)' },
                { re: '(ab)*', str: 'abab', maxL: 4, label: '(ab)*' },
                { re: 'a+', str: 'aaa', maxL: 3, label: 'a+' },
              ].map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => loadPreset(p.re, p.str, p.maxL)}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 text-slate-700 transition"
                  title={`Load ${p.re} with test string "${p.str}"`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 1 — Regular Expression */}
        <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
              1
            </span>
            <h3 className="text-lg font-bold text-slate-900">
              Section 1 — Regular Expression
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="regex-input"
                className="block text-sm font-semibold text-slate-700 mb-1.5"
              >
                Regular Expression
              </label>
              <div className="relative">
                <input
                  id="regex-input"
                  type="text"
                  value={regexInput}
                  onChange={(e) => handleRegexChange(e.target.value)}
                  placeholder="e.g. (a|b)* or a(b|c)"
                  className={`w-full font-mono text-base px-4 py-2.5 rounded-xl border bg-slate-50/50 focus:bg-white focus:outline-hidden transition ${
                    regexError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-3 focus:ring-rose-100 text-rose-950'
                      : 'border-slate-300 focus:border-indigo-600 focus:ring-3 focus:ring-indigo-100 text-slate-900'
                  }`}
                  aria-invalid={!!regexError}
                />
              </div>

              {/* Error message */}
              {regexError && (
                <div className="mt-2.5 flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <span className="font-semibold">Invalid Regular Expression: </span>
                    {regexError}
                  </div>
                </div>
              )}
            </div>

            {/* Derived Alphabet display (Section 7) */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Alphabet (Σ):</span>
                {derivedAlphabet.length > 0 ? (
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                    {`{${derivedAlphabet.join(', ')}}`}
                  </span>
                ) : (
                  <span className="text-slate-400 italic font-mono">{`∅ (Empty)`}</span>
                )}
              </div>
              <span className="text-xs text-slate-500">
                Automatically derived from literal symbols
              </span>
            </div>

            {/* Operators reference info */}
            <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 pt-1">
              <span>
                <strong className="text-slate-700 font-mono">|</strong> Union/OR
              </span>
              <span>
                <strong className="text-slate-700 font-mono">*</strong> Kleene Star
              </span>
              <span>
                <strong className="text-slate-700 font-mono">+</strong> 1+ Repetition
              </span>
              <span>
                <strong className="text-slate-700 font-mono">()</strong> Grouping
              </span>
              <span>
                <strong className="text-slate-700 font-mono">ab</strong> Concatenation
              </span>
            </div>
          </div>
        </section>

        {/* SECTION 2 — Generate Strings */}
        <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
              2
            </span>
            <h3 className="text-lg font-bold text-slate-900">
              Section 2 — Generate Strings
            </h3>
          </div>

          <form onSubmit={handleGenerateStrings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div>
                <label
                  htmlFor="max-l-input"
                  className="block text-sm font-semibold text-slate-700 mb-1.5"
                >
                  Maximum Length (L)
                </label>
                <div className="relative">
                  <input
                    id="max-l-input"
                    type="number"
                    min="0"
                    max="10"
                    step="1"
                    value={maxLengthInput}
                    onChange={(e) => setMaxLengthInput(e.target.value)}
                    placeholder="e.g. 2"
                    className="w-full font-mono text-base px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-indigo-600 focus:ring-3 focus:ring-indigo-100 transition text-slate-900"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium select-none">
                    0 ≤ |w| ≤ 10
                  </span>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 active:scale-[0.99] transition shadow-xs cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Generate Valid Strings
                </button>
              </div>
            </div>

            {/* Generation Error / Warning */}
            {generationError && (
              <div className="flex items-start gap-2 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="font-medium">{generationError}</div>
              </div>
            )}

            {/* Results Table and Count */}
            {generatedList !== null && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Generated Language Results
                  </h4>
                  <div className="text-xs sm:text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg">
                    Total Valid Strings: {generationCount}
                  </div>
                </div>

                {generatedList.length === 0 ? (
                  <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-slate-500 text-sm">
                    No valid strings found belonging to the language of length ≤{' '}
                    {maxLengthInput}.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200 shadow-2xs">
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-100/90 text-slate-700 text-xs uppercase font-bold sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-4 w-28 text-center">Length</th>
                            <th className="py-2.5 px-4">Valid String</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                          {generatedList.map((item, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-2 px-4 text-center text-slate-500 font-sans text-xs">
                                {item.length}
                              </td>
                              <td className="py-2 px-4 font-semibold text-slate-900">
                                {item.value === 'ε' ? (
                                  <span className="inline-flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md text-xs font-bold">
                                    ε <span className="font-normal font-sans text-[11px] text-indigo-500">(empty string)</span>
                                  </span>
                                ) : (
                                  item.value
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </section>

        {/* SECTION 3 — Check a String */}
        <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
              3
            </span>
            <h3 className="text-lg font-bold text-slate-900">
              Section 3 — Check a String
            </h3>
          </div>

          <form onSubmit={handleCheckString} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div>
                <label
                  htmlFor="user-string-input"
                  className="block text-sm font-semibold text-slate-700 mb-1.5"
                >
                  Enter String
                </label>
                <div className="relative">
                  <input
                    id="user-string-input"
                    type="text"
                    value={userStringInput}
                    onChange={(e) => setUserStringInput(e.target.value)}
                    placeholder="Enter string to check (e.g. abba or leave empty for ε)"
                    className="w-full font-mono text-base px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-indigo-600 focus:ring-3 focus:ring-indigo-100 transition text-slate-900"
                  />
                  {userStringInput === '' && (
                    <span className="absolute right-3 top-2.5 text-xs text-indigo-600 font-mono font-medium pointer-events-none">
                      ε (empty)
                    </span>
                  )}
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 active:scale-[0.99] transition shadow-xs cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  Check String
                </button>
              </div>
            </div>

            {/* Validation Result Display */}
            {validationResult && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                {validationResult.accepted ? (
                  <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                    <div className="flex items-center gap-2 text-base sm:text-lg font-black text-emerald-700 tracking-wide">
                      <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-600" />
                      <span>✓ ACCEPTED</span>
                    </div>
                    <p className="mt-2 text-sm sm:text-base font-mono font-medium text-emerald-900">
                      {validationResult.explanation}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950">
                    <div className="flex items-center gap-2 text-base sm:text-lg font-black text-rose-700 tracking-wide">
                      <XCircle className="w-6 h-6 shrink-0 text-rose-600" />
                      <span>✗ REJECTED</span>
                    </div>
                    <p className="mt-2 text-sm sm:text-base font-mono font-medium text-rose-900">
                      {validationResult.explanation}
                    </p>
                    {validationResult.error && (
                      <p className="mt-2 text-xs text-rose-700 flex items-center gap-1 font-sans">
                        <CornerDownRight className="w-3.5 h-3.5 shrink-0" />
                        {validationResult.error}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </form>
        </section>

        {/* Formal Theory of Computation Reference Card */}
        <section className="bg-slate-100/70 rounded-2xl p-4 sm:p-5 border border-slate-200 text-slate-600 text-xs sm:text-sm">
          <div className="flex items-center gap-2 font-bold text-slate-800 mb-2">
            <Info className="w-4 h-4 text-indigo-600" />
            Theory of Computation (TOC) Architecture Details
          </div>
          <ul className="space-y-1 list-disc list-inside text-slate-600">
            <li>
              <strong>Construction:</strong> Implements Thompson&apos;s Construction algorithm (Regular Expression &rarr; NFA with &epsilon;-transitions).
            </li>
            <li>
              <strong>Recognition:</strong> Executes &epsilon;-closure and subset state tracking on the complete input string.
            </li>
            <li>
              <strong>Generation:</strong> Performs breadth-first expansion (0 &le; |w| &le; L) with reverse reachability pruning to eliminate dead non-accepting states.
            </li>
            <li>
              <strong>Local Computation:</strong> 100% offline, privacy-preserving, and executed directly within your browser runtime.
            </li>
          </ul>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
        Alphabet Permutation Generator &bull; Theory of Computation / PBL Project &bull; PWA Ready
      </footer>
    </div>
  );
}
