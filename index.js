const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfparse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- CONFIGURAÇÃO DA IA ---
const API_KEY = 'AIzaSyCJns5JfhcVa6wepwcUCaVnkhnD-JFxP4U'; // Sua chave de API real
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
// -------------------------

const upload = multer({ storage: multer.memoryStorage() });
const app = express();
app.use(cors());

app.get('/', (req, res) => {
  res.send('Praetor IA v4.5 - Servidor de Produção Ativo.');
});

async function analisarPeticao(textoDoDocumento) {
  const prompt = `Analise o texto jurídico e retorne um objeto JSON com as seguintes chaves e formatos:
"pontuacao": (número de 0 a 100, chance de sucesso)
"teses": (array de até 3 strings, os argumentos mais importantes do autor)
"precedentes": (array de até 2 objetos, cada um com "id": string e "resumo": string, de fundamentos legais relevantes. Exemplo: [{"id": "Resp. 12345", "resumo": "Dano moral in re ipsa em negativação indevida."}])
"valorDaCausa": (string, o valor monetário da causa extraído do texto, ou "Não especificado" se não encontrado)
"valorDaCondenacao": (string, o valor monetário da condenação extraído do texto, ou "Não especificado" se não encontrado)
"dataAudiencia": (string no formato "DD/MM/AAAA", a data da próxima audiência extraída do texto, ou "Não especificado" se não encontrado)
"prazoProcessual": (string, informações sobre prazos processuais extraídas do texto, ou "Não especificado" se não encontrado)
"tipoDePeca": (string, identifique se é "peticao" ou "contestacao")

Certifique-se de que TODOS os campos solicitados estejam presentes no JSON, mesmo que com "Não especificado".
O array "precedentes" NUNCA deve estar vazio ou conter 'undefined'.

Texto para análise: """${textoDoDocumento.substring(0, 8000)}"""
Responda APENAS com o objeto JSON.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();
    console.log("Resposta bruta da IA:", rawText);
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Resposta da IA não é um JSON válido.");
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Erro no especialista de Petição:", error);
    return { pontuacao: 0, teses: ["Erro na análise de IA."], precedentes: [{id: "ERRO", resumo: "Não foi possível gerar precedentes."}] };
  }
}

async function analisarContestacao(textoDoDocumento) {
  const prompt = `Analise a peça de contestação a seguir. Identifique os 2 principais argumentos de defesa e 1 possível ponto fraco. Retorne sua análise como um objeto JSON com as chaves "tipoDePeca", "tesesDaDefesa", e "pontosFracosDaDefesa". Texto para análise: """${textoDoDocumento.substring(0, 8000)}""" Responda APENAS com o objeto JSON.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Resposta da IA não é um JSON válido.");
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Erro no especialista de Contestação:", error);
    return { tipoDePeca: "Erro", tesesDaDefesa: ["Erro na análise de IA."] };
  }
}

app.post('/v1/analise/peticao', upload.single('arquivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  try {
    const data = await pdfparse(req.file.buffer);
    const analise = await analisarPeticao(data.text);
    const { data: dbData, error: dbError } = await supabase
  .from('analyses')
  .insert([
    {
      user_id: '0901cb8f-c322-430e-a2e1-d1f33252b1ea', // Usando um user_id fixo como no seu SQL. Idealmente, você o pegaria do seu sistema de autenticação.
      case_name: 'Análise de Petição', // Você pode pegar do Lovable se ele enviar um nome de caso, ou usar um default.
      case_description: analise.teses ? analise.teses[0] : '', // Pode usar a primeira tese como descrição
      success_probability: analise.pontuacao,
      legal_theses: JSON.stringify(analise.teses), // Converta arrays/objetos para string JSON
      relevant_precedents: JSON.stringify(analise.precedentes), // Converta arrays/objetos para string JSON
      recommended_next_steps: '"{]}"', // Não pediu isso no prompt da IA, manter como vazio por agora.
      analysis_summary: '', // Não pediu isso no prompt da IA, manter como vazio.
      status: 'concluida', // Status da análise

      // --- MAPEAMENTO DOS NOVOS CAMPOS (CamelCase da IA -> Snake_Case do Supabase) ---
      valor_da_causa: analise.valorDaCausa || null, // Garante que seja null se a IA não retornar (embora o prompt peça "Não especificado")
      valor_da_condenacao: analise.valorDaCondenacao || null,
      data_audiencia: analise.dataAudiencia || null,
      prazo_processual: analise.prazoProcessual || null,
      tipo_de_peca: analise.tipoDePeca || 'peticao' // Pegue da IA ou use um default
      // ----------------------------------------------------------------------------------
    }
  ])
  .select(); // Adicione .select() se quiser que a inserção retorne os dados inseridos

if (dbError) { // Troque 'error' por 'dbError' para evitar conflito de nome
  console.error("Erro ao inserir no Supabase:", dbError);
  return res.status(500).json({ error: 'Erro ao salvar a análise no banco de dados.' });
}

// Retorne o JSON completo para o frontend, se necessário
  res.json(analise);
    res.json(analise);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao processar o PDF.' });
  }
});

app.post('/v1/analise/contestacao', upload.single('arquivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  try {
    const data = await pdfparse(req.file.buffer);
    const analise = await analisarContestacao(data.text);
    res.json(analise);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao processar o PDF.' });
  }
});

app.listen(3000, () => {
  console.log('Servidor Praetor IA v4.5 (Produção) está rodando!');
});
