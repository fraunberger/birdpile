import bcrypt from 'bcryptjs';

export async function hashCodeword(codeword: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(codeword, salt);
}

export async function verifyCodeword(codeword: string, storedHashOrText: string): Promise<boolean> {
    if (!storedHashOrText) return false;
    
    // Check if the stored string is a bcrypt hash (starts with $2a$, $2b$, or $2y$)
    if (storedHashOrText.startsWith('$2a$') || storedHashOrText.startsWith('$2b$') || storedHashOrText.startsWith('$2y$')) {
        return bcrypt.compare(codeword, storedHashOrText);
    }
    
    // Fallback: This is needed to support existing active elections that have plaintext passwords
    return codeword === storedHashOrText;
}
