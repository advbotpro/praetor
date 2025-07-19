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
  const prompt = `Sua tarefa é analisar uma petição inicial ou recurso de um autor e retornar um objeto JSON com "pontuacao", "teses", e "precedentes". A pontuação deve ser de 0 a 100, refletindo a chance de sucesso. As teses devem resumir os 3 argumentos mais importantes do autor. Os precedentes devem ser 1 ou 2 resumos de fundamentos legais aplicáveis. O array de precedentes nunca deve estar vazio ou conter 'undefined'. Texto para análise: """${textoDoDocumento.substring(0, 8000)}""" Responda APENAS com o objeto JSON.`;
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();
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
