# Ponto Crítico

Jogo de tiro tático 5×5 em primeira pessoa que roda direto no navegador (Three.js + WebGL, sem build e sem assets externos). Os cenários são originais: uma refinaria desativada, um bairro operário evacuado e um complexo de pesquisa abandonado.

## Como jogar

O jogo usa módulos ES, então precisa de um servidor HTTP simples. Abrir o `index.html` direto com `file://` não funciona.

```bash
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`, clique na tela para capturar o mouse e pressione **Esc** para pausar.

| Ação | Tecla padrão |
| --- | --- |
| Mover / pular / agachar | WASD / Espaço / Ctrl |
| Andar silencioso (sem passos audíveis, mais precisão) | Shift |
| Atirar / mirar | Botão esquerdo / direito |
| Recarregar · trocar arma | R · 1 / 2 |
| Habilidades | Q / E |
| Plantar / desarmar (segurar) | F |
| Marcar local ou inimigo · comunicação rápida | Z · V |
| Placar (Tab + Alt libera o cursor para silenciar, denunciar e elogiar) | Tab |
| Equipamento (no spawn ou na preparação) · chat | B · Enter |

Todas as teclas podem ser trocadas em **Configurações**.

## Modos

- **Treinamento**: estande com alvos fixos, alvos em movimento e duelo contra um bot Veterano (troque com **T**). A munição é infinita e o HUD mostra precisão, porcentagem de tiros na cabeça e tempo médio até o abate.
- **Confronto** (casual): 5×5 com renascimento. Vence a primeira equipe a chegar a 40 abates.
- **Domínio** (casual): três pontos de controle, primeira equipe a 150 pontos. Os pontos são calculados para ficar à mesma distância a pé dos dois spawns.
- **Ruptura** (competitivo/ranqueado): os atacantes plantam a carga em A ou B e os defensores impedem ou desarmam. Não há renascimento, vence quem fizer 7 rodadas primeiro e os lados trocam depois da 6ª. Metade do desarme fica salva se ele for interrompido.

## Design

- **Armas** (`js/config.js`): cada uma tem um padrão de recuo fixo que dá para aprender, abertura que cresce com movimento, pulo e rajada, queda de dano por distância e multiplicadores para cabeça e pernas. O Arsenal mostra os pontos fortes, as limitações e quantos tiros cada arma precisa para abater. O som é procedural com áudio 3D posicional (HRTF).
- **Agentes**: as habilidades nunca causam dano. Elas dão informação (Pulso, Sensor), controlam espaço (Cortina, Barreira, Clarão) ou sustentam a equipe (Estação médica, Placa leve).
- **Mapas** (`js/maps.js`): ficam numa grade ASCII com três rotas e conectores para flanquear. Janelas permitem atirar sem passar. `tools/validate-maps.mjs` confere se todas as áreas são alcançáveis.
- **Feedback**: marcador de acerto diferente para tiro na cabeça e para abate, números de dano, indicador da direção do dano, feed de abates e marcadores de objetivo. Ao morrer, uma recapitulação mostra quem causou quanto dano e dá uma dica do que levou à derrota.
- **Equilíbrio**: as duas equipes têm a mesma composição de agentes e bots do mesmo nível. No ranqueado, o nível acompanha a sua classificação. O spawn tem proteção de 2 s e os bots seguem exatamente as regras do jogador (mesmo recuo, abertura e visão bloqueada por fumaça).
- **Progressão**: XP, níveis, desafios diários e semanais e títulos por conquista. Tudo o que se desbloqueia é cosmético (acabamentos de arma, cartões, títulos) e nada altera dano, recuo, som ou visibilidade.
- **Acessibilidade**: paletas para deuteranopia, protanopia e tritanopia, contorno de inimigo (respeita paredes), indicadores visuais de som, legendas, redução de movimento e de tremor, escala do HUD, mira configurável, alternar ou segurar para mirar e agachar, e Clarão como véu escuro.
- **Jogo limpo**: o cliente só pede ações. A camada de autoridade (`js/integrity.js`) valida de novo cadência, alcance e linha de visão antes de aplicar dano, assina os dados de armas e física (que ficam congelados) e sinaliza velocidade impossível e giros instantâneos repetidos antes de tiros na cabeça. Contra toxicidade há filtro de chat com normalização de leetspeak, reputação, restrição temporária de chat, silenciar, denunciar, elogiar, comunicação rápida e marcações.

> Observação: neste protótipo para um jogador a autoridade roda localmente. Num jogo online, o mesmo `Integrity` rodaria no servidor.

## Estrutura

```
index.html, css/style.css
js/main.js          inicialização
js/menu.js          menus, configurações, fim de partida
js/game.js          laço de jogo, entrada, disparo, dano
js/world.js         construção da cena, colisão, raycast, A*
js/modes.js         Treinamento, Confronto, Domínio, Ruptura
js/bots.js          IA dos bots
js/combat.js        abertura, recuo, recarga
js/abilities.js     habilidades dos agentes
js/hud.js           HUD e minimapa
js/viewmodel.js     arma em primeira pessoa
js/audio.js         áudio procedural 3D
js/integrity.js     validação competitiva
js/social.js        chat, filtro, denúncias
js/progression.js   XP, desafios, cosméticos, classificação
js/vendor/          Three.js r160 (licença MIT)
```
