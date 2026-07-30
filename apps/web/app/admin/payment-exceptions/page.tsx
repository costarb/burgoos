import { getPaymentExceptions } from "../../../lib/api";
import { PaymentExceptionsClient } from "./payment-exceptions-client";

export default async function PaymentExceptionsPage() {
  return <PaymentExceptionsClient initialExceptions={await getPaymentExceptions("OPEN")} />;
}
