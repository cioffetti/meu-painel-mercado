import YahooFinance from 'yahoo-finance2';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. LIGANDO AS MÁQUINAS
const CHAVE_GEMINI = "AIzaSyDFk-t-hHijtSYXDbmtQOD62hSEjf3cRQY"; // <--- COLOQUE SUA CHAVE AQUI COM ASPAS
const genAI = new GoogleGenerativeAI(CHAVE_GEMINI);

// O TRUQUE DE MESTRE: Força a IA a responder APENAS em formato de dados puros!
const modeloIA = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" } 
});

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// 2. LISTAS DE TRABALHO (TESTE RÁPIDO)
const listaBrasil = ['PETR3.SA', 'WEGE3.SA'];
const todasAsAcoes = [...listaBrasil];
const ativosSemValuation = ['ETHE11.SA', 'QBTC11.SA', 'QSOL11.SA', 'GOLD11.SA'];

let bancoAntigo = {};
if (fs.existsSync('indicadores.json')) {
    try { bancoAntigo = JSON.parse(fs.readFileSync('indicadores.json', 'utf-8')); } catch (e) { }
}

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

async function gerarAnaliseComIA(ticker, dadosMatematicos, isETF) {
    const prompt = `
    Você é um Analista de Investimentos Sênior. Gere a análise para a empresa ${ticker} baseada nestes indicadores reais:
    P/L: ${dadosMatematicos.pl}, ROE: ${dadosMatematicos.roe}, Margem Líquida: ${dadosMatematicos.margemLiquida}.
    
    Retorne o JSON estrito obedecendo o esquema:
    {
        "analise_senior": {
            "tendencia": "texto",
            "swot": { "forcas": "...", "fraquezas": "...", "oportunidades": "...", "ameacas": "..." },
            "notas": { "roe": 4, "roic": 3, "ebitda": 5, "divida": 2, "receita": 4 }
        }
        ${!isETF ? `,
        "valuation_dcf": {
            "parametros": { "wacc": "12%", "crescimento_longo_prazo": "2%", "margem_seguranca": "20%" },
            "status": "SUPERVALORIZADA",
            "cenarios": {
                "pessimista": { "preco_justo": 20.50, "descricao": "..." },
                "base": { "preco_justo": 25.00, "descricao": "..." },
                "otimista": { "preco_justo": 30.00, "descricao": "..." }
            }
        }` : ''}
    }
    `;

    try {
        const resultado = await modeloIA.generateContent(prompt);
        // Agora podemos confiar que a resposta é 100% código JSON sem textos intrusos!
        return JSON.parse(resultado.response.text());
    } catch (erro) {
        // Se der erro, agora ele nos conta o porquê!
        console.error(`   ❌ Falha na IA para ${ticker}. Motivo real: ${erro.message}`);
        return null; 
    }
}

async function iniciarTrabalho() {
    console.log("🤖 Iniciando 'Modo Deus V2': Robô + IA Analista Sênior...\n");
    
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

            if(analiseIA) console.log(`   ✅ Tese e Valuation concluídos com sucesso para ${ticker}!\n`);

            await new Promise(r => setTimeout(r, 5000));

        } catch (erro) { 
            console.error(`   ⚠️ Erro de rede no Yahoo para ${ticker}.\n`); 
            bancoDeDadosJSON[ticker] = bancoAntigo[ticker] || {};
        }
    }

    fs.writeFileSync('indicadores.json', JSON.stringify(bancoDeDadosJSON, null, 2), 'utf-8');
    console.log("\n🎉 SUCESSO ABSOLUTO! O seu arquivo de inteligência foi atualizado pela IA.");
}

iniciarTrabalho();