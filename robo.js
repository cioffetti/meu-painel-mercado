import YahooFinance from 'yahoo-finance2';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. LIGANDO AS MÁQUINAS
const CHAVE_GEMINI = "AIzaSyCtsLVDm4fcfzfekrq-GdU218QHX9RRgEI"; // <--- COLOQUE SUA CHAVE AQUI
const genAI = new GoogleGenerativeAI(CHAVE_GEMINI);
const modeloIA = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Rápido e inteligente
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// 2. LISTAS DE TRABALHO (VERSÃO TESTE RÁPIDO)
const listaBrasil = ['PETR3.SA', 'WEGE3.SA'];
// Apagamos a listaIntl temporariamente
const todasAsAcoes = [...listaBrasil]; // Agora ele só soma a lista Brasil!
const ativosSemValuation = ['ETHE11.SA', 'QBTC11.SA', 'QSOL11.SA', 'GOLD11.SA'];
// Preserva o que já temos
let bancoAntigo = {};
if (fs.existsSync('indicadores.json')) {
    try { bancoAntigo = JSON.parse(fs.readFileSync('indicadores.json', 'utf-8')); } catch (e) { }
}

// Função para extrair a matemática do Yahoo
function extrairMatematica(result) {
    const getVal = (obj, path) => path.split('.').reduce((acc, part) => acc && acc[part], obj)?.raw || null;
    return {
        pl: getVal(result, 'summaryDetail.trailingPE') || result.summaryDetail?.trailingPE, 
        pvp: getVal(result, 'defaultKeyStatistics.priceToBook') || result.defaultKeyStatistics?.priceToBook, 
        dy: getVal(result, 'summaryDetail.dividendYield') || result.summaryDetail?.dividendYield,
        pegRatio: getVal(result, 'defaultKeyStatistics.pegRatio') || result.defaultKeyStatistics?.pegRatio, 
        evEbitda: getVal(result, 'defaultKeyStatistics.enterpriseToEbitda') || result.defaultKeyStatistics?.enterpriseToEbitda, 
        vpa: getVal(result, 'defaultKeyStatistics.bookValue') || result.defaultKeyStatistics?.bookValue,
        lpa: getVal(result, 'defaultKeyStatistics.trailingEps') || result.defaultKeyStatistics?.trailingEps, 
        psr: getVal(result, 'summaryDetail.priceToSalesTrailing12Months') || result.summaryDetail?.priceToSalesTrailing12Months, 
        roe: getVal(result, 'financialData.returnOnEquity') || result.financialData?.returnOnEquity,
        roa: getVal(result, 'financialData.returnOnAssets') || result.financialData?.returnOnAssets, 
        margemBruta: getVal(result, 'financialData.grossMargins') || result.financialData?.grossMargins, 
        margemOperacional: getVal(result, 'financialData.operatingMargins') || result.financialData?.operatingMargins,
        margemLiquida: getVal(result, 'financialData.profitMargins') || result.financialData?.profitMargins, 
        dividaPL: getVal(result, 'financialData.debtToEquity') || result.financialData?.debtToEquity, 
        liquidezCorrente: getVal(result, 'financialData.currentRatio') || result.financialData?.currentRatio
    };
}

// O CÉREBRO: Pede a análise para o Gemini
async function gerarAnaliseComIA(ticker, dadosMatematicos, isETF) {
    const prompt = `
    Você é um Analista de Investimentos Sênior. Estou te enviando os indicadores atuais da empresa/ativo ${ticker}:
    P/L: ${dadosMatematicos.pl}, P/VP: ${dadosMatematicos.pvp}, ROE: ${dadosMatematicos.roe}, Margem Líquida: ${dadosMatematicos.margemLiquida}, Dívida/PL: ${dadosMatematicos.dividaPL}.
    
    Me retorne EXCLUSIVAMENTE um objeto JSON válido (sem blocos de código \`\`\`json) com a seguinte estrutura:
    {
        "analise_senior": {
            "tendencia": "Seu texto resumindo o cenário atual e a tendência baseada nos indicadores.",
            "swot": { "forcas": "...", "fraquezas": "...", "oportunidades": "...", "ameacas": "..." },
            "notas": { "roe": (nota de 0 a 5), "roic": (nota de 0 a 5), "ebitda": (nota de 0 a 5), "divida": (nota de 0 a 5), "receita": (nota de 0 a 5) }
        }
        ${!isETF ? `,
        "valuation_dcf": {
            "parametros": { "wacc": "12%", "crescimento_longo_prazo": "2%", "margem_seguranca": "20%" },
            "status": "SUBVALORIZADA" ou "JUSTO" ou "SUPERVALORIZADA",
            "cenarios": {
                "pessimista": { "preco_justo": numero, "descricao": "..." },
                "base": { "preco_justo": numero, "descricao": "..." },
                "otimista": { "preco_justo": numero, "descricao": "..." }
            }
        }` : ''}
    }
    Seja analítico, realista e direto. ${isETF ? 'Como é um ETF, NÃO inclua a chave valuation_dcf.' : ''}
    `;

    try {
        const resultado = await modeloIA.generateContent(prompt);
        let textoResposta = resultado.response.text().trim();
        // Limpa formatação Markdown indesejada
        textoResposta = textoResposta.replace(/```json/g, '').replace(/```/g, '');
        return JSON.parse(textoResposta);
    } catch (erro) {
        console.error(`   ❌ Falha na IA para ${ticker}. Usando dados antigos.`);
        return null; // Se a IA falhar, não quebra o robô
    }
}

async function iniciarTrabalho() {
    console.log("🤖 Iniciando 'Modo Deus': Robô + IA Analista Sênior...\n");
    console.log("Isso pode levar alguns minutos (respeitando limites da API). Pegue um café! ☕\n");
    
    const bancoDeDadosJSON = {};
    const dataHoje = new Date().toLocaleDateString('pt-BR'); 

    for (const ticker of todasAsAcoes) {
        try {
            console.log(`⏳ [${ticker}] Baixando indicadores do Yahoo...`);
            const resultYahoo = await yahooFinance.quoteSummary(ticker, { modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData'] });
            const matematica = extrairMatematica(resultYahoo);
            
            const isETF = ativosSemValuation.includes(ticker);
            
            console.log(`🧠 [${ticker}] Solicitando análise e Valuation ao Gemini...`);
            const analiseIA = await gerarAnaliseComIA(ticker, matematica, isETF);

            bancoDeDadosJSON[ticker] = {
                ...matematica,
                data_referencia: dataHoje,
                analise_senior: analiseIA ? analiseIA.analise_senior : (bancoAntigo[ticker]?.analise_senior || {}),
                valuation_dcf: isETF ? null : (analiseIA ? analiseIA.valuation_dcf : (bancoAntigo[ticker]?.valuation_dcf || null))
            };

            console.log(`   ✅ Tese concluída para ${ticker}!\n`);

            // DELAY OBRIGATÓRIO: A API gratuita tem limites de requisições por minuto.
            // 5 segundos de pausa garante que não seremos bloqueados.
            await new Promise(r => setTimeout(r, 5000));

        } catch (erro) { 
            console.error(`   ⚠️ Pulei a empresa ${ticker}. Retendo dados antigos.\n`); 
            bancoDeDadosJSON[ticker] = bancoAntigo[ticker] || {};
        }
    }

    fs.writeFileSync('indicadores.json', JSON.stringify(bancoDeDadosJSON, null, 2), 'utf-8');
    console.log("\n🎉 SUCESSO ABSOLUTO! O seu arquivo de inteligência foi atualizado pela IA.");
}

iniciarTrabalho();