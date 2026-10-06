/**
 * Theory of Computation (TOC) / PBL Engine
 *
 * Implements formal language processing:
 * 1. Regular Expression Parsing (Syntax validation & Shunting-Yard Infix to Postfix)
 * 2. Thompson's Construction (Regular Expression -> Non-deterministic Finite Automaton with ε-transitions)
 * 3. ε-Closure and State Transition Simulation
 * 4. Backward Reachability Trimming (Dead-state elimination)
 * 5. String Recognition / Validation (Accepted vs Rejected)
 * 6. Systematic String Generation up to Maximum Length L (0 ≤ |w| ≤ L)
 */

export interface NFAState {
  id: number;
  symbolTransitions: Map<string, number[]>; // symbol -> target state ids
  epsilonTransitions: number[]; // ε-transitions (empty transitions)
}

export interface NFA {
  states: NFAState[];
  startState: number;
  acceptState: number;
  alphabet: string[];
}

export interface ValidationResult {
  accepted: boolean;
  explanation: string;
  error?: string;
}

export interface GeneratedStringItem {
  length: number;
  value: string; // "ε" for empty string, or actual characters
  rawString: string; // "" for empty string
}

export interface GenerationResult {
  success: boolean;
  strings: GeneratedStringItem[];
  totalCount: number;
  errorMessage?: string;
}

// ============================================================================
// 1. REGULAR EXPRESSION PARSING & SYNTAX VALIDATION
// ============================================================================

/**
 * Validates the syntax of a regular expression according to formal TOC rules.
 * Supported operators:
 *  - '|' : Union / Alternation
 *  - '*' : Kleene Star (0 or more repetitions)
 *  - '+' : Kleene Plus (1 or more repetitions)
 *  - '(', ')' : Grouping
 *  - Concatenation : Juxtaposition (implicit)
 */
export function validateRegexSyntax(regex: string): { valid: boolean; error?: string } {
  const trimmed = regex.trim();
  if (!trimmed) {
    return { valid: false, error: 'Empty regular expression. Please enter a regular expression.' };
  }

  // Check for disallowed characters (only allow letters, digits, and valid operators: | * + ( ))
  // Allow spaces between tokens, which we will strip for processing.
  let openParens = 0;
  let prevChar = '';

  const clean = trimmed.replace(/\s+/g, '');
  if (!clean) {
    return { valid: false, error: 'Regular expression cannot be only spaces.' };
  }

  const validSymbols = /^[a-zA-Z0-9]$/;
  const isOperator = (ch: string) => ['|', '*', '+', '(', ')'].includes(ch);

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (!validSymbols.test(ch) && !isOperator(ch)) {
      return {
        valid: false,
        error: `Invalid character '${ch}' in regular expression. Only alphanumeric symbols and operators (| * + ( )) are allowed.`,
      };
    }

    if (ch === '(') {
      openParens++;
      // Check for empty parentheses ()
      if (i + 1 < clean.length && clean[i + 1] === ')') {
        return { valid: false, error: "Invalid Regular Expression: Empty group '()'." };
      }
    } else if (ch === ')') {
      openParens--;
      if (openParens < 0) {
        return { valid: false, error: 'Invalid Regular Expression: Unbalanced parentheses (extra closing parenthesis).' };
      }
    }

    // Invalid operator placement:
    // '*' or '+' at the beginning of expression or right after '(' or '|'
    if (ch === '*' || ch === '+') {
      if (i === 0) {
        return { valid: false, error: `Invalid Regular Expression: Operator '${ch}' cannot appear at the beginning.` };
      }
      if (prevChar === '(' || prevChar === '|') {
        return { valid: false, error: `Invalid Regular Expression: Operator '${ch}' cannot directly follow '${prevChar}'.` };
      }
      if (prevChar === '*' || prevChar === '+') {
        return { valid: false, error: `Invalid Regular Expression: Consecutive repetition operators '${prevChar}${ch}'.` };
      }
    }

    // '|' at the beginning, immediately after '(' or '|'
    if (ch === '|') {
      if (i === 0) {
        return { valid: false, error: "Invalid Regular Expression: Union operator '|' cannot appear at the beginning." };
      }
      if (prevChar === '(') {
        return { valid: false, error: "Invalid Regular Expression: Union operator '|' cannot directly follow '('." };
      }
      if (prevChar === '|') {
        return { valid: false, error: "Invalid Regular Expression: Consecutive union operators '||'." };
      }
    }

    prevChar = ch;
  }

  if (openParens > 0) {
    return { valid: false, error: 'Invalid Regular Expression: Unbalanced parentheses (missing closing parenthesis).' };
  }

  // Trailing '|'
  if (clean[clean.length - 1] === '|') {
    return { valid: false, error: "Invalid Regular Expression: Trailing '|' operator." };
  }

  return { valid: true };
}

/**
 * Automatically derives the alphabet Σ from literal symbols present in the regex.
 */
export function extractAlphabet(regex: string): string[] {
  const clean = regex.replace(/\s+/g, '');
  const symbols = new Set<string>();
  const isOperator = (ch: string) => ['|', '*', '+', '(', ')'].includes(ch);

  for (const ch of clean) {
    if (!isOperator(ch)) {
      symbols.add(ch);
    }
  }

  return Array.from(symbols).sort();
}

/**
 * Inserts explicit concatenation operator '·' between adjacent tokens:
 * - between literal and literal: "ab" -> "a·b"
 * - between literal and '(': "a(b)" -> "a·(b)"
 * - between ')' and literal: "(a)b" -> "(a)·b"
 * - between ')' and '(': "(a)(b)" -> "(a)·(b)"
 * - between '*' or '+' and literal: "a*b" -> "a*·b"
 * - between '*' or '+' and '(': "a*(b)" -> "a*·(b)"
 */
function insertExplicitConcatenation(regex: string): string[] {
  const clean = regex.replace(/\s+/g, '');
  const tokens: string[] = [];
  const isOperator = (ch: string) => ['|', '*', '+', '(', ')'].includes(ch);

  for (let i = 0; i < clean.length; i++) {
    const curr = clean[i];
    tokens.push(curr);

    if (i + 1 < clean.length) {
      const next = clean[i + 1];

      const currIsLiteral = !isOperator(curr);
      const nextIsLiteral = !isOperator(next);

      const currCanBeLeftOfConcat = currIsLiteral || curr === '*' || curr === '+' || curr === ')';
      const nextCanBeRightOfConcat = nextIsLiteral || next === '(';

      if (currCanBeLeftOfConcat && nextCanBeRightOfConcat) {
        tokens.push('·'); // explicit concatenation token
      }
    }
  }

  return tokens;
}

/**
 * Converts regular expression tokens from infix to postfix notation
 * using the Shunting-Yard algorithm.
 * Operator Precedence:
 *  - Postfix unary: '*', '+' (Precedence 3)
 *  - Infix binary: '·' (Concatenation, Precedence 2, Left-associative)
 *  - Infix binary: '|' (Union, Precedence 1, Left-associative)
 */
function infixToPostfix(tokens: string[]): string[] {
  const output: string[] = [];
  const opStack: string[] = [];

  const precedence: Record<string, number> = {
    '*': 3,
    '+': 3,
    '·': 2,
    '|': 1,
  };

  for (const token of tokens) {
    if (token === '(') {
      opStack.push(token);
    } else if (token === ')') {
      while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
        output.push(opStack.pop()!);
      }
      if (opStack.length > 0 && opStack[opStack.length - 1] === '(') {
        opStack.pop(); // remove '('
      }
    } else if (token in precedence) {
      // Unary operators (* and +) are postfix: they can be pushed or applied immediately
      if (token === '*' || token === '+') {
        output.push(token);
      } else {
        // Binary operators ('·', '|')
        while (
          opStack.length > 0 &&
          opStack[opStack.length - 1] !== '(' &&
          precedence[opStack[opStack.length - 1]] >= precedence[token]
        ) {
          output.push(opStack.pop()!);
        }
        opStack.push(token);
      }
    } else {
      // Literal symbol
      output.push(token);
    }
  }

  while (opStack.length > 0) {
    const op = opStack.pop()!;
    if (op !== '(' && op !== ')') {
      output.push(op);
    }
  }

  return output;
}

// ============================================================================
// 2. THOMPSON'S CONSTRUCTION (REGULAR EXPRESSION -> NFA)
// ============================================================================

interface NFASubgraph {
  start: number;
  accept: number;
}

/**
 * Builds an NFA with ε-transitions using Thompson's Construction.
 */
export function buildNFA(regex: string): { nfa?: NFA; error?: string } {
  const validation = validateRegexSyntax(regex);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const alphabet = extractAlphabet(regex);
  const tokens = insertExplicitConcatenation(regex);
  const postfix = infixToPostfix(tokens);

  const states: NFAState[] = [];
  const createState = (): number => {
    const id = states.length;
    states.push({
      id,
      symbolTransitions: new Map(),
      epsilonTransitions: [],
    });
    return id;
  };

  const addSymbolTransition = (from: number, symbol: string, to: number) => {
    const list = states[from].symbolTransitions.get(symbol) || [];
    list.push(to);
    states[from].symbolTransitions.set(symbol, list);
  };

  const addEpsilonTransition = (from: number, to: number) => {
    states[from].epsilonTransitions.push(to);
  };

  const stack: NFASubgraph[] = [];

  for (const token of postfix) {
    if (token === '·') {
      // Concatenation: A · B
      if (stack.length < 2) return { error: 'Invalid Regular Expression syntax during concatenation.' };
      const b = stack.pop()!;
      const a = stack.pop()!;
      // Connect accept state of A to start state of B via ε-transition
      addEpsilonTransition(a.accept, b.start);
      stack.push({ start: a.start, accept: b.accept });
    } else if (token === '|') {
      // Union: A | B
      if (stack.length < 2) return { error: 'Invalid Regular Expression syntax during union.' };
      const b = stack.pop()!;
      const a = stack.pop()!;
      const start = createState();
      const accept = createState();

      // Branch to both A and B
      addEpsilonTransition(start, a.start);
      addEpsilonTransition(start, b.start);

      // Join both accepts into the new accept state
      addEpsilonTransition(a.accept, accept);
      addEpsilonTransition(b.accept, accept);

      stack.push({ start, accept });
    } else if (token === '*') {
      // Kleene Star: A*
      if (stack.length < 1) return { error: 'Invalid Regular Expression syntax during Kleene star.' };
      const a = stack.pop()!;
      const start = createState();
      const accept = createState();

      // ε-transition from start to accept (zero repetitions / ε)
      addEpsilonTransition(start, accept);
      // ε-transition into A
      addEpsilonTransition(start, a.start);
      // ε-transition loop back from A accept to A start
      addEpsilonTransition(a.accept, a.start);
      // ε-transition exit from A accept to new accept
      addEpsilonTransition(a.accept, accept);

      stack.push({ start, accept });
    } else if (token === '+') {
      // Kleene Plus: A+ (1 or more repetitions)
      if (stack.length < 1) return { error: 'Invalid Regular Expression syntax during Kleene plus.' };
      const a = stack.pop()!;
      const start = createState();
      const accept = createState();

      // Must enter A at least once
      addEpsilonTransition(start, a.start);
      // Loop back for multiple repetitions
      addEpsilonTransition(a.accept, a.start);
      // Exit from A accept to new accept
      addEpsilonTransition(a.accept, accept);

      stack.push({ start, accept });
    } else {
      // Literal symbol
      const start = createState();
      const accept = createState();
      addSymbolTransition(start, token, accept);
      stack.push({ start, accept });
    }
  }

  if (stack.length !== 1) {
    return { error: 'Invalid Regular Expression: Failed to construct finite automaton.' };
  }

  const finalFragment = stack.pop()!;

  return {
    nfa: {
      states,
      startState: finalFragment.start,
      acceptState: finalFragment.accept,
      alphabet,
    },
  };
}

// ============================================================================
// 3. ε-CLOSURE & AUTOMATON SIMULATION
// ============================================================================

/**
 * Computes the ε-closure of a given set of NFA states.
 * Returns the set of all states reachable by zero or more ε-transitions.
 */
export function computeEpsilonClosure(nfa: NFA, initialStates: Iterable<number>): Set<number> {
  const closure = new Set<number>(initialStates);
  const queue: number[] = Array.from(closure);

  while (queue.length > 0) {
    const stateId = queue.pop()!;
    const state = nfa.states[stateId];
    if (state && state.epsilonTransitions) {
      for (const nextId of state.epsilonTransitions) {
        if (!closure.has(nextId)) {
          closure.add(nextId);
          queue.push(nextId);
        }
      }
    }
  }

  return closure;
}

/**
 * Computes move(S, a): the set of states reachable from any state in S
 * on reading input symbol a.
 */
function move(nfa: NFA, states: Set<number>, symbol: string): Set<number> {
  const targets = new Set<number>();
  for (const s of states) {
    const list = nfa.states[s].symbolTransitions.get(symbol);
    if (list) {
      for (const t of list) {
        targets.add(t);
      }
    }
  }
  return targets;
}

/**
 * Precomputes reverse reachability from acceptState.
 * A state s is "alive" if there is a path from s to acceptState.
 * States that cannot reach acceptState can be pruned during string generation.
 */
function computeCanReachAccept(nfa: NFA): boolean[] {
  const n = nfa.states.length;
  const canReach = new Array<boolean>(n).fill(false);
  const reverseAdj: number[][] = Array.from({ length: n }, () => []);

  for (let u = 0; u < n; u++) {
    // Symbol transitions u -> v
    for (const [, targets] of nfa.states[u].symbolTransitions.entries()) {
      for (const v of targets) {
        reverseAdj[v].push(u);
      }
    }
    // Epsilon transitions u -> v
    for (const v of nfa.states[u].epsilonTransitions) {
      reverseAdj[v].push(u);
    }
  }

  // BFS backwards from acceptState
  canReach[nfa.acceptState] = true;
  const queue: number[] = [nfa.acceptState];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const pred of reverseAdj[curr]) {
      if (!canReach[pred]) {
        canReach[pred] = true;
        queue.push(pred);
      }
    }
  }

  return canReach;
}

// ============================================================================
// 4. FUNCTION 2 — VALIDATE USER STRING
// ============================================================================

/**
 * Validates a user-given string against the regular expression.
 * Returns:
 *  - accepted: boolean
 *  - explanation: formal reason explaining the outcome
 *  - error: string if the string contains symbols outside the alphabet
 */
export function checkUserString(regex: string, userString: string): ValidationResult {
  const buildResult = buildNFA(regex);
  if (buildResult.error || !buildResult.nfa) {
    return {
      accepted: false,
      explanation: buildResult.error || 'Invalid regular expression.',
      error: buildResult.error || 'Invalid regular expression.',
    };
  }

  const nfa = buildResult.nfa;
  const alphabetSet = new Set(nfa.alphabet);

  // Check if string contains symbols not in the regular expression's alphabet
  for (const char of userString) {
    if (!alphabetSet.has(char)) {
      return {
        accepted: false,
        explanation: `${userString} does not belong to the language represented by ${regex}.`,
        error: "The entered string contains symbols that are not part of the regular expression's alphabet.",
      };
    }
  }

  // Automaton simulation on the user string
  let currentStates = computeEpsilonClosure(nfa, [nfa.startState]);

  for (const char of userString) {
    const nextStates = move(nfa, currentStates, char);
    currentStates = computeEpsilonClosure(nfa, nextStates);
    if (currentStates.size === 0) {
      // Early exit if no states are active
      break;
    }
  }

  const isAccepted = currentStates.has(nfa.acceptState);
  const displayString = userString.length === 0 ? 'ε (empty string)' : userString;

  if (isAccepted) {
    return {
      accepted: true,
      explanation: `${displayString} belongs to the language represented by ${regex}.`,
    };
  } else {
    return {
      accepted: false,
      explanation: `${displayString} does not belong to the language represented by ${regex}.`,
    };
  }
}

// ============================================================================
// 5. FUNCTION 1 — GENERATE VALID STRINGS UP TO LENGTH L
// ============================================================================

/**
 * Generates all valid strings of length ≤ L belonging to the language of the regex.
 * Sorts results by increasing string length, then lexicographically.
 * Handles empty string as 'ε'.
 */
export function generateValidStrings(regex: string, maxL: number): GenerationResult {
  if (maxL === undefined || maxL === null || isNaN(maxL)) {
    return {
      success: false,
      strings: [],
      totalCount: 0,
      errorMessage: 'Please enter a valid numeric maximum length L.',
    };
  }

  if (maxL < 0 || !Number.isInteger(maxL)) {
    return {
      success: false,
      strings: [],
      totalCount: 0,
      errorMessage: 'Maximum length L must be a non-negative integer (0 ≤ L ≤ 10).',
    };
  }

  if (maxL > 10) {
    return {
      success: false,
      strings: [],
      totalCount: 0,
      errorMessage: 'Maximum length L cannot exceed 10.',
    };
  }

  const buildResult = buildNFA(regex);
  if (buildResult.error || !buildResult.nfa) {
    return {
      success: false,
      strings: [],
      totalCount: 0,
      errorMessage: buildResult.error || 'Invalid regular expression syntax.',
    };
  }

  const nfa = buildResult.nfa;
  const alphabet = nfa.alphabet;
  const canReachAccept = computeCanReachAccept(nfa);

  const MAX_STRINGS_LIMIT = 5000;
  const validStrings: GeneratedStringItem[] = [];

  // BFS Queue tracking: { states: Set<number>, str: string }
  const initialClosure = computeEpsilonClosure(nfa, [nfa.startState]);

  // Check if start state can reach accept
  let initialAlive = false;
  for (const s of initialClosure) {
    if (canReachAccept[s]) {
      initialAlive = true;
      break;
    }
  }

  if (!initialAlive) {
    // Language is completely empty
    return {
      success: true,
      strings: [],
      totalCount: 0,
    };
  }

  const queue: Array<{ states: Set<number>; str: string }> = [
    { states: initialClosure, str: '' },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Check if the current string is accepted by the NFA
    if (current.states.has(nfa.acceptState)) {
      validStrings.push({
        length: current.str.length,
        value: current.str.length === 0 ? 'ε' : current.str,
        rawString: current.str,
      });

      if (validStrings.length > MAX_STRINGS_LIMIT) {
        return {
          success: false,
          strings: [],
          totalCount: 0,
          errorMessage: 'Too many possible strings. Please use a smaller value of L.',
        };
      }
    }

    // Expand to next length if |str| < maxL
    if (current.str.length < maxL) {
      for (const char of alphabet) {
        const targetStates = move(nfa, current.states, char);
        if (targetStates.size > 0) {
          const nextClosure = computeEpsilonClosure(nfa, targetStates);

          // Prune dead branches: check if any state in nextClosure can reach accept
          let isAlive = false;
          for (const s of nextClosure) {
            if (canReachAccept[s]) {
              isAlive = true;
              break;
            }
          }

          if (isAlive) {
            queue.push({
              states: nextClosure,
              str: current.str + char,
            });

            // Prevent queue from growing uncontrollably
            if (queue.length > 25000) {
              return {
                success: false,
                strings: [],
                totalCount: 0,
                errorMessage: 'Too many possible strings. Please use a smaller value of L.',
              };
            }
          }
        }
      }
    }
  }

  // Sort results by increasing string length, then lexicographical order
  validStrings.sort((a, b) => {
    if (a.length !== b.length) {
      return a.length - b.length;
    }
    return a.rawString.localeCompare(b.rawString);
  });

  return {
    success: true,
    strings: validStrings,
    totalCount: validStrings.length,
  };
}
