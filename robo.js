import 'dotenv/config';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const YahooFinanceClass = require('yahoo-finance2').default;
const yahooFinance = new YahooFinanceClass(); 

// 🔑 Rota Paid Tier - Google liberado para 2.000 RPM
const urlIA = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${process.env.CHAVE_GEMINI_2}`;

async function colheitaPersistenteTotal() {
    const NOME_COFRE = './indicadores.json';
    const NOME_LISTA = './meus_ativos.json';

    if (!fs.existsSync(NOME_LISTA)) return console.error("❌ Erro: Lista não encontrada!");
    const categorias = JSON.parse(fs.readFileSync(NOME_LISTA, 'utf8'));
    const listaAtivos = [...(categorias.acoes_brasil || []), ...(categorias.acoes_usa || []), ...(categorias.criptos || [])];
    
    let bancoTotal = fs.existsSync(NOME_COFRE) ? JSON.parse(fs.readFileSync(NOME_COFRE, 'utf8')) : {};

    console.log(`\n🚀 [${new Date().toLocaleTimeString()}] MODO TANQUE: PAID TIER + PERSISTÊNCIA ATIVADOS`);

    for (let i = 0; i < listaAtivos.length; i++) {
        const ticker = listaAtivos[i];
        
        // 🧠 Sensor de Recuperação: Pula se já auditado com sucesso
        if (bancoTotal[ticker] && bancoTotal[ticker].veredito && bancoTotal[ticker].veredito !== "Pendente") {
            console.log(`⏭️  [${i + 1}/${listaAtivos.length}] ${ticker} já auditado.`);
            continue;
        }

        console.log(`\n[${i + 1}/${listaAtivos.length}] 🚀 Analisando: ${ticker}...`);

        let sucesso = false;
        let tentativasAtivo = 0;
        const MAX_TENTATIVAS = 4; // 1 normal + 3 de recuperação

        while (tentativasAtivo < MAX_TENTATIVAS && !sucesso) {
            try {
                // 1. Extração Yahoo
                const d = await yahooFinance.quoteSummary(ticker, { 
                    modules: ["defaultKeyStatistics", "financialData", "summaryDetail", "price"] 
                });

                const stats = {
                    preco: d.price?.regularMarketPrice || 0,
                    lpa: d.defaultKeyStatistics?.trailingEps || 0,
                    roe: (d.financialData?.returnOnEquity || 0) * 100,
                    vpa: d.defaultKeyStatistics?.bookValue || 0,
                    dy: (d.summaryDetail?.dividendYield || 0) * 100
                };

                // 2. Chamada IA com Perícia e Trava JSON
                const payload = {
                    contents: [{ role: "user", parts: [{ text: `Analise sênior de ${ticker}. Preço ${stats.preco}, LPA ${stats.lpa}, ROE ${stats.roe.toFixed(2)}%. Retorne APENAS JSON: {"resumo_balanco": "", "noticias_balanco": {"boas": [], "ruins": []}, "noticias_dia": {"boas": [], "ruins": []}, "veredito": "Compra/Venda/Manter", "estrelas": 5}` }] }],
                    generationConfig: { 
                        thinkingConfig: { thinkingLevel: "HIGH" },
                        responseMimeType: "application/json" 
                    }
                };

                const responseIA = await fetch(urlIA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const resJson = await responseIA.json();

                // --- 🛡️ PERÍCIA TÉCNICA (DETALHAMENTO DO ERRO) ---
                if (resJson.error) {
                    console.error(`❌ [ERRO API] Código: ${resJson.error.code} | Mensagem: ${resJson.error.message}`);
                    throw new Error(`Google API: ${resJson.error.status}`);
                }

                if (!resJson.candidates || !resJson.candidates[0]) {
                    console.warn(`⚠️ [IA VAZIA] Resposta bloqueada ou nula.`);
                    throw new Error("Candidatos Vazios");
                }

                // Parse Seguro do JSON
                try {
                    const textoRaw = resJson.candidates[0].content.parts[0].text;
                    const analiseIA = JSON.parse(textoRaw);

                    // 3. Gravação Final
                    bancoTotal[ticker] = { ...stats, ...analiseIA, data_atualizacao: new Date().toLocaleString('pt-BR') };
                    fs.writeFileSync(NOME_COFRE, JSON.stringify(bancoTotal, null, 2));
                    
                    console.log(`✅ ${ticker} finalizado com sucesso! (Tentativa ${tentativasAtivo + 1})`);
                    sucesso = true;

                } catch (parseErr) {
                    console.error(`❌ [ERRO JSON] Texto malformado recebido.`);
                    console.log("Início do texto bruto:", resJson.candidates[0].content.parts[0].text.substring(0, 150));
                    throw new Error("Falha no Parse JSON");
                }

            } catch (err) {
                tentativasAtivo++;
                console.error(`⚠️ Falha em ${ticker} (Tentativa ${tentativasAtivo}/${MAX_TENTATIVAS}): ${err.message}`);
                
                if (tentativasAtivo < MAX_TENTATIVAS) {
                    console.log(`⏳ Aguardando 15s para a próxima tentativa de recuperação interna...`);
                    await new Promise(r => setTimeout(r, 15000)); // Tempo menor no Paid Tier para re-tentar
                }
            }
        }

        // --- 🛑 FREIO DE SEGURANÇA YAHOO (60 SEGUNDOS) ---
        if (i < listaAtivos.length - 1 && sucesso) {
            console.log(`⏳ Aguardando 60s para não estressar o Yahoo Finance...`);
            await new Promise(r => setTimeout(r, 60000));
        }
    }

    console.log("\n🏁 Colheita Finalizada com Persistência Máxima!");
}

colheitaPersistenteTotal();