import Link from "next/link";
import styles from "../../page.module.css";

export default function PagamentoFalhouPage() {
  return (
    <main className={styles.wrapper}>
      <section className={styles.card}>
        <h1 className={styles.title}>Pagamento nao concluido</h1>
        <p className={styles.text}>
          O pagamento foi cancelado ou falhou. Voce pode voltar e tentar novamente pelo Checkout Pro.
        </p>
        <Link href="/" className={styles.link}>
          Voltar para tentar novamente
        </Link>
      </section>
    </main>
  );
}
