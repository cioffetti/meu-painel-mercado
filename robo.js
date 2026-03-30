import YahooFinance from 'yahoo-finance2';
import fs from 'fs';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const listaBrasil = ['AGRO3.SA', 'AMOB3.SA', 'BBAS3.SA', 'BBDC3.SA', 'BBSE3.SA', 'BRSR6.SA', 'B3SA3.SA', 'CMIG3.SA', 'CXSE3.SA', 'EGIE3.SA', 'EQTL3.SA', 'ETHE11.SA', 'EZTC3.SA', 'FLRY3.SA', 'GMAT3.SA', 'GOLD11.SA', 'ITSA4.SA', 'KEPL3.SA', 'KLBN3.SA', 'LEVE3.SA', 'MBRF3.SA', 'PETR3.SA', 'PRIO3.SA', 'PSSA3.SA', 'QBTC11.SA', 'QSOL11.SA', 'RAIZ4.SA', 'RANI3.SA', 'SAPR4.SA', 'SBFG3.SA', 'SMTO3.SA', 'SOJA3.SA', 'SUZB3.SA', 'TAEE11.SA', 'TTEN3.SA', 'VAMO3.SA', 'VIVT3.SA', 'WEGE3.SA'];
const listaIntl = ['GOOGL', 'AMZN', 'NVDA', 'TSM', 'ASML', 'AVGO', 'IRS', 'TSLA', 'MU', 'VZ', 'T', 'HD', 'SHOP', 'DIS', 'SPG', 'ANET', 'ICE', 'KO', 'EQNR', 'EPR', 'WFC', 'VICI', 'O', 'CPRT', 'ASX', 'CEPU', 'NVO', 'PLTR', 'JBL', 'QCOM', 'AAPL', 'MSFT', 'BAC', 'ORCL', 'EQT', 'MNST', 'CVS', 'HUYA', 'GPC', 'PFE', 'ROKU', 'DIBS', 'LEG', 'MBUU', 'FVRR'];
const todasAsAcoes = [...listaBrasil, ...listaIntl];

// Lê o banco atual para não apagar a sua análise manual!
let bancoAntigo = {};
if (fs.existsSync('indicadores.json')) {
    try { bancoAntigo = JSON.parse(fs.readFileSync('indicadores.json', 'utf-8')); } catch (e) { }
}

function formatarIndicadores(result, ticker) {
    const getVal = (obj, path) => path.split('.').reduce((acc, part) => acc && acc[part], obj)?.raw || null;
    
    // Resgata a análise que você já digitou antes (se existir), senão cria um Template vazio
    const analiseSalva = bancoAntigo[ticker]?.analise_senior || {
        tendencia: "Aguardando análise do especialista...",
        swot: { forcas: "-", fraquezas: "-", oportunidades: "-", ameacas: "-" },
        notas: { roe: 0, roic: 0, ebitda: 0, divida: 0, receita: 0 }
    };

    const dataHoje = new Date().toLocaleDateString('pt-BR'); // Ex: 29/03/2026

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
        liquidezCorrente: getVal(result, 'financialData.currentRatio') || result.financialData?.currentRatio,
        
        // O NOVO MÓDULO DO ANALISTA SÊNIOR
        data_referencia: dataHoje,
        analise_senior: analiseSalva
    };
}

async function iniciarTrabalho() {
    console.log("🤖 Iniciando Robô com Preservação de Análise Setorial...\n");
    const bancoDeDadosJSON = {};

    for (const ticker of todasAsAcoes) {
        try {
            const result = await yahooFinance.quoteSummary(ticker, { modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData'] });
            bancoDeDadosJSON[ticker] = formatarIndicadores(result, ticker);
            console.log(`   ✅ Dados numéricos atualizados para ${ticker}`);
            await new Promise(r => setTimeout(r, 2000));
        } catch (erro) { console.error(`   ⚠️ Erro em ${ticker}.`); }
    }

    fs.writeFileSync('indicadores.json', JSON.stringify(bancoDeDadosJSON, null, 2), 'utf-8');
    console.log("\n🎉 Arquivo 'indicadores.json' gerado! Suas análises de texto foram preservadas!");
}

iniciarTrabalho();