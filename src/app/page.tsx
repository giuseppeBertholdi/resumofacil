"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { criteriosGregosAntigos } from "@/lib/criteria";
import styles from "./page.module.css";

type PixResponse = {
  paymentId?: string | number;
  status?: string;
  qrCode?: string | null;
  qrCodeBase64?: string | null;
  ticketUrl?: string | null;
  error?: string;
};

type AiResponse = {
  answer?: string;
  error?: string;
};

type AssistantMode = "pergunta" | "resumo" | "exercicios";

type AccessResponse = {
  hasAccess?: boolean;
};

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderSimpleMarkdown(markdown: string) {
  let html = escapeHtml(markdown);

  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/^\- (.*)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*<\/li>)/g, "<ul>$1</ul>");
  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;

  return html;
}

export default function Home() {
  const [userEmail, setUserEmail] = useState<string>("");
  const [accessToken, setAccessToken] = useState<string>("");
  const [hasPremiumAccess, setHasPremiumAccess] = useState(false);
  const [pixData, setPixData] = useState<PixResponse | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [isLoadingPix, setIsLoadingPix] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("pergunta");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string>("");

  useEffect(() => {
    const loadUser = async () => {
      if (!supabase) {
        return;
      }
      const [{ data: userData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);

      setUserEmail(userData.user?.email ?? "");
      setAccessToken(sessionData.session?.access_token ?? "");
    };

    void loadUser();
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user?: { email?: string }; access_token?: string } | null) => {
      setUserEmail(session?.user?.email ?? "");
      setAccessToken(session?.access_token ?? "");
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setHasPremiumAccess(false);
      return;
    }

    const checkAccess = async () => {
      setIsCheckingAccess(true);

      try {
        const response = await fetch("/api/payments/access-status", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const result = (await response.json()) as AccessResponse;
        setHasPremiumAccess(Boolean(result.hasAccess));
      } catch {
        setHasPremiumAccess(false);
      } finally {
        setIsCheckingAccess(false);
      }
    };

    void checkAccess();
  }, [accessToken]);

  const isLoggedIn = useMemo(() => Boolean(userEmail), [userEmail]);

  const beginAutoGoogleLoginForPayment = async () => {
    if (!supabase) {
      setFeedback("Configure o Supabase no .env para habilitar o login Google.");
      return;
    }

    const redirectTo = `${window.location.origin}?autoPay=1`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      setFeedback(`Erro no login Google: ${error.message}`);
      return;
    }

    setFeedback("Antes de pagar, voce fara login Google automaticamente...");
  };

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const shouldAutoPay = params.get("autoPay") === "1";

    if (!shouldAutoPay) {
      return;
    }

    void handleGeneratePix();
    params.delete("autoPay");
    const nextQuery = params.toString();
    const cleanUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);
  }, [isLoggedIn]);

  const handlePayButtonClick = async () => {
    if (!isLoggedIn) {
      await beginAutoGoogleLoginForPayment();
      return;
    }

    await handleGeneratePix();
  };

  const handleGeneratePix = async () => {
    if (!accessToken) {
      setFeedback("Faca login com Google antes de pagar.");
      return;
    }

    setFeedback("");
    setPixData(null);
    setIsLoadingPix(true);

    try {
      const response = await fetch("/api/payments/checkout-pro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = (await response.json()) as PixResponse;

      if (!response.ok) {
        setFeedback(result.error ?? "Nao foi possivel gerar o PIX.");
        return;
      }

      if (!result.qrCodeBase64 || !result.qrCode) {
        setFeedback("PIX gerado sem QR completo. Tente novamente.");
        return;
      }

      setPixData(result);
      setFeedback("PIX gerado. Escaneie o QR ou copie o codigo.");
    } catch {
      setFeedback("Falha de conexao ao gerar o PIX.");
    } finally {
      setIsLoadingPix(false);
    }
  };

  const handleAskAi = async () => {
    if (!accessToken) {
      setFeedback("Faca login e realize o pagamento para usar a IA.");
      return;
    }

    if (!hasPremiumAccess) {
      setFeedback("A IA premium so funciona para quem pagou via PIX no Mercado Pago.");
      return;
    }

    if (!prompt.trim()) {
      setFeedback("Escreva sua pergunta, resumo ou pedido de exercicios.");
      return;
    }

    setFeedback("");
    setAnswer("");
    setIsLoadingAi(true);

    try {
      const response = await fetch("/api/ai/study", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ prompt, mode: assistantMode }),
      });

      const result = (await response.json()) as AiResponse;

      if (!response.ok) {
        setFeedback(result.error ?? "Nao foi possivel gerar resposta da IA.");
        return;
      }

      setAnswer(result.answer ?? "");
    } catch {
      setFeedback("Erro de conexao com a IA.");
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleCheckAccess = async () => {
    if (!accessToken) {
      setFeedback("Faca login com Google para verificar acesso.");
      return;
    }

    setFeedback("");
    setIsCheckingAccess(true);

    try {
      const response = await fetch("/api/payments/access-status", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = (await response.json()) as AccessResponse;
      const hasAccess = Boolean(result.hasAccess);
      setHasPremiumAccess(hasAccess);
      setFeedback(
        hasAccess
          ? "Pagamento confirmado. IA premium liberada."
          : "Pagamento ainda nao confirmado. Se acabou de pagar, aguarde e tente de novo.",
      );
    } catch {
      setFeedback("Erro ao verificar status do pagamento.");
    } finally {
      setIsCheckingAccess(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.center}>
        <section className={styles.salesCard}>
          <span className={styles.badge}>IA de Historia para 1a serie</span>
          <h1 className={styles.title}>Pergunte, gere resumo e crie exercicios em segundos</h1>
          <p className={styles.subtitle}>
            Baseado no livro didatico e nos criterios da prova. Simples, intuitivo e feito para
            estudar rapido.
          </p>

          <div className={styles.priceWrap}>
            <strong>R$ 4,99</strong>
            <span>Acesso premium com todos os criterios + livro didatico</span>
          </div>

          <div className={styles.modeSelector}>
            <button
              className={assistantMode === "pergunta" ? styles.modeActive : styles.modeButton}
              type="button"
              onClick={() => setAssistantMode("pergunta")}
            >
              Pergunta
            </button>
            <button
              className={assistantMode === "resumo" ? styles.modeActive : styles.modeButton}
              type="button"
              onClick={() => setAssistantMode("resumo")}
            >
              Resumo
            </button>
            <button
              className={assistantMode === "exercicios" ? styles.modeActive : styles.modeButton}
              type="button"
              onClick={() => setAssistantMode("exercicios")}
            >
              Exercicios
            </button>
          </div>

          <textarea
            className={styles.bigInput}
            placeholder="Digite aqui sua pergunta ou tema. Ex.: 'Faça um resumo do Periodo Classico e 5 exercicios com gabarito.'"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />

          <div className={styles.mainActions}>
            {!isLoggedIn ? (
              <button onClick={handlePayButtonClick} className={styles.payButton} type="button">
                {isLoadingPix ? "Gerando PIX..." : "Pagar R$ 4,99"}
              </button>
            ) : (
              <>
                <button onClick={handleAskAi} className={styles.askButton} type="button">
                  {isLoadingAi ? "Gerando resposta..." : "Gerar com IA"}
                </button>
                <button onClick={handlePayButtonClick} className={styles.payButton} type="button">
              {isLoadingPix ? "Gerando PIX..." : "Gerar PIX R$ 4,99"}
                </button>
                <button onClick={handleCheckAccess} className={styles.checkButton} type="button">
                  {isCheckingAccess ? "Verificando..." : "Ja paguei: verificar acesso"}
                </button>
              </>
            )}
          </div>

          {isLoggedIn && <p className={styles.email}>Conectado como: {userEmail}</p>}
          <p className={styles.accessStatus}>
            Status IA premium: {hasPremiumAccess ? "Liberada" : "Bloqueada ate pagamento PIX"}
          </p>

          {feedback && <p className={styles.feedback}>{feedback}</p>}

          {answer && (
            <article className={styles.answerBox}>
              <h2>Resposta da IA</h2>
              <div
                className={styles.markdown}
                // We escape HTML first in renderSimpleMarkdown.
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(answer) }}
              />
            </article>
          )}

          {pixData?.qrCodeBase64 && (
            <article className={styles.pixBox}>
              <h2>Pague com PIX</h2>
              <Image
                src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                alt="QR Code PIX"
                width={220}
                height={220}
                className={styles.pixImage}
              />
              {pixData.qrCode && (
                <textarea
                  className={styles.pixCode}
                  readOnly
                  value={pixData.qrCode}
                  onFocus={(event) => event.currentTarget.select()}
                />
              )}
              {pixData.ticketUrl && (
                <a
                  className={styles.pixLink}
                  href={pixData.ticketUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir instrucao do PIX no Mercado Pago
                </a>
              )}
            </article>
          )}

        </section>
        <aside className={styles.bookPanel}>
          <Image
            src="/livro-historia.jpg"
            alt="Livro de Historia 1a serie"
            width={250}
            height={360}
            className={styles.bookImage}
            priority
          />
          <p>Livro base: Historia 1a serie - Bom Jesus Editora</p>
          <div className={styles.criteriaBox}>
            <h3>Criterios atuais (Gregos Antigos)</h3>
            <ul>
              {criteriosGregosAntigos.map((criterio) => (
                <li key={criterio}>{criterio}</li>
              ))}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
