
export default class MathCaptcha {
    public static generateCaptcha(): [string, (input: string) => boolean] {
        let num1 = 0;
        let num2 = 0;

        num1 = Math.round(Math.random() * (8)) + 1;
        num2 = Math.round(Math.random() * (8)) + 1;

        const check = (inputString: string): boolean => {
            const input = parseInt(inputString, 10);
            return input === (num1 + num2);
        };

        const textOutput = `${num1} plus ${num2} equals ??`;

        return [textOutput, check];
    }
}
