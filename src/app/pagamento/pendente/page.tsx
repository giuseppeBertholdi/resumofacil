import Link from "next/link";
import styles from "../../page.module.css";

export default function PagamentoPendentePage() {
  return (
    <main className={styles.wrapper}>
      <section className={styles.card}>
        <h1 className={styles.title}>Pagamento pendente</h1>
        <p className={styles.text}>
          Recebemos sua tentativa de pagamento. Como PIX pode ser assincrono no Checkout Pro, aguarde
          a confirmacao para liberar o acesso automaticamente.
        </p>
        <Link href="/" className={styles.link}>
          Voltar para a pagina inicial
        </Link>
      </section>
    </main>
  );
}
