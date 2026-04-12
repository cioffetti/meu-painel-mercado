import 'dotenv/config';
import fs from 'fs';
import YahooFinance from 'yahoo-finance2';
import { GoogleGenerativeAI } from '@google/generative-ai';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

// 🔑 Conectando EXCLUSIVAMENTE na CHAVE_GEMINI_1 para não roubar limite do Servidor
const genAI = new GoogleGenerativeAI(process.env.CHAVE_GEMINI_1);
const modeloIA = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" } 
});

const ARQUIVO_COFRE = './indicadores.json';
const MAX_TENTATIVAS = 3;

// Apenas Ações, pois Criptos e Moedas não possuem balanço patrimonial nos moldes tradicionais
const listaAtivos = [
    'AGRO3.SA', 'BBAS3.SA', 'BBDC3.SA', 'CMIG3.SA', 'EGIE3.SA', 'ITSA4.SA', 'PETR3.SA', 'TAEE11.SA', 'WEGE3.SA',
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA'
    // Você pode expandir essa lista futuramente com os outros ativos do seu painel
];

async function extrairFundamentos(ticker) {
    try {
        const quote = await yahooFinance.quoteSummary(ticker, { modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'price'] });
        const sd = quote.summaryDetail || {};
        const ks = quote.defaultKeyStatistics || {};
        const fd = quote.financialData || {};
        const pr = quote.price || {};

        return {
            preco: pr.regularMarketPrice || null,
            vpa: ks.bookValue || null,
            lpa: ks.trailingEps || null,
            dy: sd.dividendYield || null,
            roe: fd.returnOnEquity || null,
            roic: fd.returnOnAssets || null,
            pl: sd.trailingPE || null,
            pegRatio: ks.pegRatio || null,
            pvp: ks.priceToBook || null,
            margemLiquida: fd.profitMargins || null,
            dividaEbitda: fd.totalDebt / fd.ebitda || null,
            liquidezCorrente: fd.currentRatio || null
        };
    } catch (e) {
        console.log(`⚠️ Sem dados fundamentais completos para ${ticker}`);
        return null;
    }
}

async function analisarAtivoIA(ticker, fundamentos) {
    const prompt = `Você é um Sênior Equity Researcher. Baseado nestes fundamentos do ativo ${ticker}: ${JSON.stringify(fundamentos)}
    
    Retorne ESTRITAMENTE um JSON com as seguintes chaves e subchaves:
    {
      "resumo_balanco": "Texto de 3 linhas avaliando a saúde financeira",
      "noticias_balanco": {
        "boas": ["Fato positivo 1", "Fato positivo 2"],
        "ruins": ["Fato negativo 1", "Fato negativo 2"]
      },
      "noticias_dia": {
        "boas": ["Notícia recente positiva 1"],
        "ruins": ["Notícia recente negativa 1"]
      },
      "graham": {
        "preco_justo": Numero_Double_Calculado_Formula_Raiz(22.5 * VPA * LPA),
        "margem": Numero_Double_Percentual_Upside,
        "vpa": Numero_Double_VPA,
        "lpa": Numero_Double_LPA
      },
      "bazin": {
        "preco_teto": Numero_Double_Calculado_Formula_Dividendo_Min_6_Porcento,
        "margem": Numero_Double_Percentual_Upside,
        "dpa_projetado": Numero_Double_Dividendo_Por_Acao,
        "yield_projetado": Numero_Double_Dividend_Yield_Atual
      },
      "formula_magica": {
        "posicao_ranking": Numero_Inteiro_Simulado,
        "status": "String (COMPRA, ESPERA ou VENDA)",
        "ev_ebit": Numero_Double_EV_EBIT,
        "roic": Numero_Double_ROIC_Percentual
      },
      "analise_senior": {
        "tendencia": "Texto de 2 linhas com a tese de investimento",
        "swot": {
          "forcas": "Texto curto",
          "fraquezas": "Texto curto",
          "oportunidades": "Texto curto",
          "ameacas": "Texto curto"
        },
        "notas": {
          "roe": Numero_0_a_5,
          "roic": Numero_0_a_5,
          "ebitda": Numero_0_a_5,
          "divida": Numero_0_a_5,
          "receita": Numero_0_a_5
        }
      },
      "valuation_dcf": {
        "status": "String (SUBVALORIZADA, JUSTA ou SUPERVALORIZADA)",
        "parametros": {
          "wacc": "Percentual String",
          "crescimento_longo_prazo": "Percentual String",
          "margem_seguranca": "Percentual String"
        },
        "cenarios": {
          "pessimista": { "preco_justo": Numero, "descricao": "Tese pessimista curta" },
          "base": { "preco_justo": Numero, "descricao": "Tese base curta" },
          "otimista": { "preco_justo": Numero, "descricao": "Tese otimista curta" }
        }
      }
    }`;

    const resultado = await modeloIA.generateContent(prompt);
    return JSON.parse(resultado.response.text());
}

async function rodarRoboInteligencia() {
    console.log(`\n🧠 [${new Date().toLocaleTimeString()}] INICIANDO ROBO DE INTELIGÊNCIA ARTIFICIAL...`);
    
    // Abre o cofre atual sem destruir o que o robo_cotacoes fez
    let cofre = fs.existsSync(ARQUIVO_COFRE) ? JSON.parse(fs.readFileSync(ARQUIVO_COFRE, 'utf8')) : {};

    for (let ticker of listaAtivos) {
        let tentativas = 0;
        let sucesso = false;

        while (tentativas < MAX_TENTATIVAS && !sucesso) {
            try {
                console.log(`\n🔍 Extraindo fundamentos de ${ticker}...`);
                const fundamentos = await extrairFundamentos(ticker);
                
                if (!fundamentos || !fundamentos.preco) {
                    console.log(`⏭️ Pulando ${ticker} (Faltam dados base)`);
                    break;
                }

                console.log(`🤖 Enviando para o Sênior Equity Researcher (Gemini 2)...`);
                const analise = await analisarAtivoIA(ticker, fundamentos);

                // 🛡️ TRAVA DE SEGURANÇA: Mantém o gráfico (historico5A) e junta com a Inteligência Nova
                if (!cofre[ticker]) cofre[ticker] = {};
                
                cofre[ticker] = {
                    ...cofre[ticker],     // Mantém preço, variação e gráficos existentes
                    ...fundamentos,       // Adiciona os fundamentos matemáticos extraídos
                    ...analise,           // Adiciona todos os textos e avaliações geradas pelo Sênior
                    data_referencia: new Date().toLocaleDateString('pt-BR')
                };

                sucesso = true;
                console.log(`✅ Inteligência de ${ticker} gravada no Cofre!`);

            } catch (err) {
                tentativas++;
                console.error(`⚠️ Erro na IA para ${ticker} (Tentativa ${tentativas}/${MAX_TENTATIVAS})`);
                if (tentativas < MAX_TENTATIVAS) {
                    await new Promise(r => setTimeout(r, 5000));
                }
            }
        }
        
        // Respiro pro Gemini não barrar
        await new Promise(r => setTimeout(r, 3000));
    }

    fs.writeFileSync(ARQUIVO_COFRE, JSON.stringify(cofre, null, 2), 'utf8');
    console.log(`\n🎉 [${new Date().toLocaleTimeString()}] INTELIGÊNCIA GRAVADA. COFRE BLINDADO!`);
}

rodarRoboInteligencia();