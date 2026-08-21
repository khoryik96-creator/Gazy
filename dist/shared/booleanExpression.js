/**
 * Safe evaluator for the "Boolean Filter" rule (e.g. "React" AND "AWS" NOT "Intern").
 *
 * MV3 forbids eval()/Function()-style string evaluation in extension contexts
 * (no `unsafe-eval` in the default CSP), so rules are tokenized and parsed
 * into a closure tree instead of compiled into JS source.
 */
function tokenize(rule) {
    const tokens = [];
    // A bare word is a search term unless it is exactly AND / OR / NOT (uppercase),
    // matching LinkedIn's convention: `Java AND REST NOT Intern` needs no quotes;
    // quotes are only needed for multi-word phrases (`"machine learning"`). Terms
    // may contain tech symbols so `c++`, `c#`, `node.js`, `full-stack` work bare.
    const re = /\s*(?:"([^"]*)"|'([^']*)'|(\()|(\))|([A-Za-z0-9][A-Za-z0-9#+.\-_]*))\s*/y;
    let pos = 0;
    while (pos < rule.length) {
        re.lastIndex = pos;
        const match = re.exec(rule);
        if (!match || match.index !== pos) {
            throw new Error('Invalid Boolean rule syntax.');
        }
        if (match[1] !== undefined || match[2] !== undefined) {
            tokens.push({ type: 'STRING', value: match[1] !== undefined ? match[1] : match[2] });
        }
        else if (match[3]) {
            tokens.push({ type: 'LPAREN' });
        }
        else if (match[4]) {
            tokens.push({ type: 'RPAREN' });
        }
        else if (match[5]) {
            const word = match[5];
            if (word === 'AND' || word === 'OR' || word === 'NOT') {
                tokens.push({ type: word });
            }
            else {
                tokens.push({ type: 'STRING', value: word });
            }
        }
        pos = re.lastIndex;
    }
    return tokens;
}
/**
 * All search terms in a rule (quoted or bare), in order — used to derive scoring
 * keywords from a Boolean rule. Returns [] for an empty rule; throws (like the
 * parser) on characters it can't tokenize, so callers that want best-effort
 * extraction should catch.
 */
export function ruleTerms(rule) {
    if (!rule || !rule.trim())
        return [];
    return tokenize(rule)
        .filter((t) => t.type === 'STRING')
        .map((t) => t.value);
}
class BooleanRuleParser {
    constructor(tokens) {
        this.pos = 0;
        this.tokens = tokens;
    }
    peek() {
        return this.tokens[this.pos];
    }
    next() {
        return this.tokens[this.pos++];
    }
    parseOr() {
        let left = this.parseAnd();
        while (this.peek()?.type === 'OR') {
            this.next();
            const right = this.parseAnd();
            const prev = left;
            left = (text) => prev(text) || right(text);
        }
        return left;
    }
    parseAnd() {
        let left = this.parseUnary();
        // `NOT` is accepted as a binary operator here (`A NOT B` == `A AND NOT B`),
        // matching the recruiter/LinkedIn convention and this module's own doc
        // example (`"React" AND "AWS" NOT "Intern"`). Prefix `NOT` (`NOT "x"`,
        // `A AND NOT "x"`) is still handled by parseUnary.
        while (this.peek()?.type === 'AND' || this.peek()?.type === 'NOT') {
            const op = this.next().type;
            const right = this.parseUnary();
            const prev = left;
            left =
                op === 'NOT' ? (text) => prev(text) && !right(text) : (text) => prev(text) && right(text);
        }
        return left;
    }
    parseUnary() {
        if (this.peek()?.type === 'NOT') {
            this.next();
            const operand = this.parseUnary();
            return (text) => !operand(text);
        }
        return this.parsePrimary();
    }
    parsePrimary() {
        const token = this.peek();
        if (!token)
            throw new Error('Invalid Boolean rule syntax.');
        if (token.type === 'LPAREN') {
            this.next();
            const expr = this.parseOr();
            if (this.peek()?.type !== 'RPAREN')
                throw new Error('Invalid Boolean rule syntax: missing ")".');
            this.next();
            return expr;
        }
        if (token.type === 'STRING') {
            this.next();
            const needle = token.value.toLowerCase();
            return (text) => (needle.length === 0 ? true : text.includes(needle));
        }
        throw new Error('Invalid Boolean rule syntax.');
    }
}
/** Compiles a rule string into an evaluator function: (lowercasedText) => boolean */
export function compileBooleanRule(rule) {
    if (!rule || !rule.trim())
        return () => true;
    const tokens = tokenize(rule);
    if (tokens.length === 0)
        return () => true;
    const parser = new BooleanRuleParser(tokens);
    const evaluator = parser.parseOr();
    if (parser.pos !== tokens.length)
        throw new Error('Invalid Boolean rule syntax.');
    return evaluator;
}
export function evaluateBoolean(profileText, rule) {
    const evaluator = compileBooleanRule(rule);
    return evaluator(profileText.toLowerCase());
}
