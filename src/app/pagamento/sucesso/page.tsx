import Link from "next/link";
import styles from "../../page.module.css";

export default function PagamentoSucessoPage() {
  return (
    <main className={styles.wrapper}>
      <section className={styles.card}>
        <h1 className={styles.title}>Pagamento aprovado</h1>
        <p className={styles.text}>
          Seu pagamento foi concluido com sucesso. O acesso premium da IA deve ser liberado apos a
          confirmacao no backend.
        </p>
        <Link href="/" className={styles.link}>
          Voltar para a pagina inicial
        </Link>
      </section>
    </main>
  );
}
