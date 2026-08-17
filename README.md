# SaveThediscord — protótipo

Protótipo pessoal de uma sala por link para compartilhar uma tela diretamente entre navegadores, com chat e controles individuais de volume.

## Rodar localmente

```powershell
npm install
npm run dev
```

Abra o endereço exibido pelo Vite em dois navegadores ou em dois computadores. Crie uma sala, copie o link, entre com outro apelido e use **Compartilhar tela**.

## Áudio e Discord

Para não vazar a chamada do Discord, compartilhe uma **aba do navegador** e marque o áudio dessa aba. Ao compartilhar a tela inteira ou um programa, o navegador pode incluir o áudio do sistema, inclusive o Discord; o app mostra esse aviso antes da captura.

Cada espectador ajusta seu próprio volume ou mudo no cartão de vídeo. Isso não altera o áudio de quem transmite.

## Limitações do protótipo

- O vídeo é WebRTC ponto a ponto; o servidor não recebe a mídia.
- Usa STUN público para facilitar conexões domésticas, mas redes restritas podem precisar de TURN (ainda não incluído).
- A qualidade final depende do navegador, PC e rede.
- O isolamento garantido de áudio de programas locais (como VLC sem o Discord) requer o futuro transmissor Windows; este protótipo já isola áudio de abas.

## Publicar gratuitamente

Depois de autenticar sua conta Cloudflare no terminal:

```powershell
npx wrangler login
npm run deploy
```

O comando exibirá uma URL `workers.dev` para compartilhar com seus amigos.
