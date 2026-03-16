import { NextResponse } from "next/server";
import { criteriosGregosAntigos } from "@/lib/criteria";
import { getAuthenticatedUserFromRequest } from "@/lib/server/supabaseAuth";
import { hasApprovedPixAccess } from "@/lib/server/paymentAccess";

type StudyRequestBody = {
  prompt?: string;
  mode?: "pergunta" | "resumo" | "exercicios";
};

export async function POST(request: Request) {
  const user = await getAuthenticatedUserFromRequest(request);
  const openAiApiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!user) {
    return NextResponse.json(
      {
        error: "Faca login com Google para usar a IA premium.",
      },
      { status: 401 },
    );
  }

  const hasAccess = await hasApprovedPixAccess({
    email: user.email,
    externalReference: `premium-${user.id}`,
  });

  if (!hasAccess) {
    return NextResponse.json(
      {
        error: "A IA premium so esta disponivel apos pagamento PIX aprovado no Mercado Pago.",
      },
      { status: 402 },
    );
  }

  if (!openAiApiKey) {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY nao configurada no .env.",
      },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as StudyRequestBody;
  const prompt = body.prompt?.trim();
  const mode = body.mode || "pergunta";

  if (!prompt) {
    return NextResponse.json(
      {
        error: "Envie um texto para a IA.",
      },
      { status: 400 },
    );
  }

  const modeInstruction =
    mode === "resumo"
      ? "Entregue um resumo em topicos, claro e objetivo."
      : mode === "exercicios"
        ? "Crie 5 exercicios com gabarito no final."
        : "Responda a pergunta de forma didatica e direta.";

  const criteriaText = criteriosGregosAntigos.map((item) => `- ${item}`).join("\n");

  const systemPrompt = `
Voce e um tutor de Historia para a 1a serie do Ensino Medio.
Responda sempre em portugues do Brasil.
Baseie-se nestes criterios da prova sobre Gregos Antigos:
${criteriaText}

Regras:
- Mantenha linguagem simples e didatica.
- Se a pergunta sair do tema, conecte de volta ao conteudo cobrado.
- Priorize clareza para estudo rapido.
- ${modeInstruction}
`.trim();

  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    }),
    cache: "no-store",
  });

  const data = await openAiResponse.json();

  if (!openAiResponse.ok) {
    return NextResponse.json(
      {
        error: "Nao foi possivel gerar resposta com a OpenAI.",
        details: data,
      },
      { status: openAiResponse.status },
    );
  }

  const answer = data?.choices?.[0]?.message?.content;

  if (!answer || typeof answer !== "string") {
    return NextResponse.json(
      {
        error: "A OpenAI respondeu sem texto utilizavel.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    answer,
    model,
  });
}
