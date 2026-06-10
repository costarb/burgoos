import { Injectable } from "@nestjs/common";
import { compare, hash } from "bcryptjs";

@Injectable()
export class AuthCryptoService {
  hashSecret(secret: string): Promise<string> {
    return hash(secret, 12);
  }

  verifySecret(secret: string, hashedSecret: string): Promise<boolean> {
    return compare(secret, hashedSecret);
  }
}
