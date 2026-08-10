export interface ExpressionToken {
  type: 'NUMBER' | 'IDENTIFIER' | 'OPERATOR' | 'LPAREN' | 'RPAREN';
  value: string | number;
}

export class BIExpressionService {
  /**
   * Tokeniza a fórmula em tokens numéricos, identificadores de métricas ou operadores matemáticos.
   * Lança erro se houver caracteres inválidos/não autorizados.
   */
  public tokenize(formula: string): ExpressionToken[] {
    const tokens: ExpressionToken[] = [];
    let cursor = 0;

    while (cursor < formula.length) {
      const char = formula[cursor];
      if (!char) break;

      // Ignora espaços em branco
      if (/\s/.test(char)) {
        cursor++;
        continue;
      }

      // Números (inteiros e decimais)
      const nextChar = formula[cursor + 1] ?? '';
      if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(nextChar))) {
        let numStr = '';
        while (cursor < formula.length) {
          const currentChar = formula[cursor];
          if (currentChar && (/[0-9]/.test(currentChar) || currentChar === '.')) {
            numStr += currentChar;
            cursor++;
          } else {
            break;
          }
        }
        const numVal = parseFloat(numStr);
        if (isNaN(numVal)) {
          throw new Error(`Número inválido na fórmula: ${numStr}`);
        }
        tokens.push({ type: 'NUMBER', value: numVal });
        continue;
      }

      // Identificadores (aliases de métricas agregadas)
      if (/[a-zA-Z_]/.test(char)) {
        let idStr = '';
        while (cursor < formula.length) {
          const currentChar = formula[cursor];
          if (currentChar && /[a-zA-Z0-9_]/.test(currentChar)) {
            idStr += currentChar;
            cursor++;
          } else {
            break;
          }
        }
        tokens.push({ type: 'IDENTIFIER', value: idStr });
        continue;
      }

      // Operadores matemáticos simples
      if (['+', '-', '*', '/', '%'].includes(char)) {
        tokens.push({ type: 'OPERATOR', value: char });
        cursor++;
        continue;
      }

      // Parênteses
      if (char === '(') {
        tokens.push({ type: 'LPAREN', value: '(' });
        cursor++;
        continue;
      }
      if (char === ')') {
        tokens.push({ type: 'RPAREN', value: ')' });
        cursor++;
        continue;
      }

      throw new Error(`Caractere não permitido ou símbolo suspeito na fórmula: "${char}"`);
    }

    return tokens;
  }

  /**
   * Converte tokens em Notação Polonesa Reversa (RPN) usando algoritmo Shunting-Yard.
   */
  public parseToRPN(tokens: ExpressionToken[]): ExpressionToken[] {
    const outputQueue: ExpressionToken[] = [];
    const operatorStack: ExpressionToken[] = [];

    const precedence: Record<string, number> = {
      '+': 1,
      '-': 1,
      '*': 2,
      '/': 2,
      '%': 2,
    };

    for (const token of tokens) {
      if (token.type === 'NUMBER' || token.type === 'IDENTIFIER') {
        outputQueue.push(token);
      } else if (token.type === 'OPERATOR') {
        const op1 = String(token.value);
        while (operatorStack.length > 0) {
          const top = operatorStack[operatorStack.length - 1];
          if (top && top.type === 'OPERATOR') {
            const op2 = String(top.value);
            const prec1 = precedence[op1] ?? 0;
            const prec2 = precedence[op2] ?? 0;
            if (prec2 >= prec1) {
              const popped = operatorStack.pop();
              if (popped) outputQueue.push(popped);
              continue;
            }
          }
          break;
        }
        operatorStack.push(token);
      } else if (token.type === 'LPAREN') {
        operatorStack.push(token);
      } else if (token.type === 'RPAREN') {
        let foundLparen = false;
        while (operatorStack.length > 0) {
          const top = operatorStack.pop();
          if (!top) break;
          if (top.type === 'LPAREN') {
            foundLparen = true;
            break;
          }
          outputQueue.push(top);
        }
        if (!foundLparen) {
          throw new Error('Parênteses desbalanceados na fórmula (faltou parêntese de abertura).');
        }
      }
    }

    while (operatorStack.length > 0) {
      const top = operatorStack.pop();
      if (!top) break;
      if (top.type === 'LPAREN' || top.type === 'RPAREN') {
        throw new Error('Parênteses desbalanceados na fórmula.');
      }
      outputQueue.push(top);
    }

    return outputQueue;
  }

  /**
   * Avalia a fila RPN usando o mapa de valores de cada linha.
   */
  public evaluateRPN(rpnQueue: ExpressionToken[], context: Record<string, number>): number {
    const stack: number[] = [];

    for (const token of rpnQueue) {
      if (token.type === 'NUMBER') {
        stack.push(Number(token.value));
      } else if (token.type === 'IDENTIFIER') {
        const idName = String(token.value);
        const val = context[idName];
        if (val === undefined || val === null) {
          stack.push(0);
        } else {
          stack.push(Number(val));
        }
      } else if (token.type === 'OPERATOR') {
        if (stack.length < 2) {
          throw new Error(`Operador "${token.value}" requer 2 operandos.`);
        }
        const b = stack.pop() ?? 0;
        const a = stack.pop() ?? 0;
        let res = 0;

        switch (token.value) {
          case '+':
            res = a + b;
            break;
          case '-':
            res = a - b;
            break;
          case '*':
            res = a * b;
            break;
          case '/':
            res = b === 0 ? 0 : a / b;
            break;
          case '%':
            res = b === 0 ? 0 : a % b;
            break;
        }

        if (isNaN(res) || !isFinite(res)) {
          res = 0;
        }
        stack.push(res);
      }
    }

    if (stack.length !== 1) {
      throw new Error('Expressão matemática malformatada.');
    }

    return stack[0] ?? 0;
  }

  /**
   * Valida se todos os identificadores na fórmula correspondem aos aliases de métricas declarados.
   */
  public validateFormula(formula: string, allowedAliases: string[]): void {
    const tokens = this.tokenize(formula);
    const rpn = this.parseToRPN(tokens);

    for (const token of rpn) {
      if (token.type === 'IDENTIFIER') {
        const alias = String(token.value);
        if (!allowedAliases.includes(alias)) {
          throw new Error(
            `A fórmula referencia a métrica "${alias}" que não foi incluída na lista de métricas selecionadas.`
          );
        }
      }
    }
  }

  /**
   * Avalia a fórmula para uma linha agregada de resultado.
   */
  public evaluate(formula: string, rowValues: Record<string, number>): number {
    const tokens = this.tokenize(formula);
    const rpn = this.parseToRPN(tokens);
    return this.evaluateRPN(rpn, rowValues);
  }
}
