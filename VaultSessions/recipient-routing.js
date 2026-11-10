'use strict';
(function(root) {
  const aliases={gpt:'chatgpt',chatgpt:'chatgpt',gemini:'gemini',claude:'claude',grok:'grok'};
  const names={chatgpt:'ChatGPT',gemini:'Gemini',claude:'Claude',grok:'Grok'};
  function mention(text) {
    // Recognize @ mentions anywhere; do not match To inside another English word.
    const match=/(?:@(ChatGPT|GPT|Gemini|Claude|Grok)|(?:^|[^A-Za-z0-9_])To\s+(ChatGPT|GPT|Gemini|Claude|Grok))(?![A-Za-z0-9_])/i.exec(text);
    return match ? aliases[(match[1]||match[2]).toLowerCase()] : null;
  }
  function choose(text, connected, random=Math.random) {
    const specified=mention(text);
    if(specified){
      if(!connected.includes(specified))throw new Error(`指定された${names[specified]}は未接続です。公式タブのログインと参加状態を確認してください。`);
      return specified;
    }
    if(!connected.length)throw new Error('接続中のAIがありません。公式タブを開いてログインしてください。');
    const value=random();
    if(!Number.isFinite(value)||value<0||value>=1)throw new Error('最初の回答者を選択できませんでした。もう一度送信してください。');
    return connected[Math.floor(value*connected.length)];
  }
  const api={mention,choose};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoundtableRecipients=api;
})(globalThis);
