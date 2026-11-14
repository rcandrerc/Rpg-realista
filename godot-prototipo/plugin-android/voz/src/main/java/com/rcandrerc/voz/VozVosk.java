package com.rcandrerc.voz;

import android.os.Handler;
import android.os.Looper;
import java.util.HashSet;
import java.util.Set;
import org.godotengine.godot.Godot;
import org.godotengine.godot.plugin.GodotPlugin;
import org.godotengine.godot.plugin.SignalInfo;
import org.godotengine.godot.plugin.UsedByGodot;
import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;

// Escuta contínua (André 2026-11-14: "quero o jogo hands-free por alguns minutos"). O reconhecedor do Android fecha e
// reabre a cada frase e perde o que se fala no meio; o Vosk (Apache 2.0, roda no celular, sem internet) deixa o
// microfone aberto direto e só procura as palavras dos comandos (gramática montada no voz.gd). O modelo de voz (~50 MB)
// é baixado pelo jogo na primeira vez que liga e fica no celular. Desligado: microfone fechado, nada rodando.
public class VozVosk extends GodotPlugin {
    private final Handler principal = new Handler(Looper.getMainLooper());
    private Model modelo;
    private String modeloDir = "";
    private Recognizer rec;
    private SpeechService escuta;
    private volatile boolean ativo = false, pausado = false;
    // ligar/desligar rápido: o carregamento velho não abre o microfone. Tudo do microfone (rec, escuta) só mexe na linha
    // principal do Android; o modelo só dentro do synchronized (conselho 2026-11-14: corrida entre as linhas).
    private final java.util.concurrent.atomic.AtomicInteger geracao = new java.util.concurrent.atomic.AtomicInteger();

    public VozVosk(Godot godot) { super(godot); }

    @Override public String getPluginName() { return "VozVosk"; }

    @Override public Set<SignalInfo> getPluginSignals() {
        Set<SignalInfo> s = new HashSet<>();
        s.add(new SignalInfo("ouviu", String.class));   // fim da frase
        s.add(new SignalInfo("parcial", String.class)); // pedaço enquanto ainda fala
        s.add(new SignalInfo("estado", String.class));  // "carregando", "escutando", "erro:texto"
        return s;
    }

    // dir: pasta do modelo (com final.mdl); gramatica: lista JSON das palavras, ou "" para frase livre
    @UsedByGodot
    public void ligar(final String dir, final String gramatica) {
        ativo = true;
        final int g = geracao.incrementAndGet();
        emitSignal("estado", "carregando");
        principal.post(this::desligar_ja);
        new Thread(() -> {
            try {
                Recognizer r;
                synchronized (VozVosk.this) {
                    if (modelo == null || !modeloDir.equals(dir)) {
                        if (modelo != null) modelo.close();
                        modelo = new Model(dir);
                        modeloDir = dir;
                    }
                    r = (gramatica == null || gramatica.isEmpty())
                            ? new Recognizer(modelo, 16000f) : new Recognizer(modelo, 16000f, gramatica);
                }
                principal.post(() -> abrir(g, r));
            } catch (Exception e) {
                principal.post(() -> { if (g == geracao.get()) { ativo = false; emitSignal("estado", "erro:" + e.getMessage()); } });
            }
        }, "VozVosk").start();
    }

    private void abrir(int g, Recognizer r) {
        if (g != geracao.get() || !ativo) { r.close(); return; }
        try {
            rec = r;
            escuta = new SpeechService(rec, 16000f);
            escuta.startListening(new Ouvinte());
            if (pausado) escuta.setPause(true);
            emitSignal("estado", "escutando");
        } catch (Exception e) {
            desligar_ja();
            ativo = false;
            emitSignal("estado", "erro:" + e.getMessage());
        }
    }

    @UsedByGodot
    public void desligar() {
        ativo = false;
        final int g = geracao.incrementAndGet();
        principal.post(() -> {
            desligar_ja();
            // desligado não guarda o modelo (~50 MB) na memória; ligar de novo carrega em uns 2 s
            new Thread(() -> {
                synchronized (VozVosk.this) {
                    if (g == geracao.get() && !ativo && modelo != null) { modelo.close(); modelo = null; modeloDir = ""; }
                }
            }, "VozVosk").start();
        });
    }

    private void desligar_ja() {
        if (escuta != null) {
            try { escuta.stop(); escuta.shutdown(); } catch (Exception e) { }
            escuta = null;
        }
        if (rec != null) {
            try { rec.close(); } catch (Exception e) { }
            rec = null;
        }
    }

    @Override public void onMainPause() {
        pausado = true;
        principal.post(() -> { if (escuta != null) escuta.setPause(true); });
    }

    @Override public void onMainResume() {
        pausado = false;
        principal.post(() -> { if (escuta != null) escuta.setPause(false); });
    }

    @Override public void onMainDestroy() {
        ativo = false;
        principal.post(this::desligar_ja);
    }

    private static String texto(String json, String chave) {
        try { return new JSONObject(json).optString(chave, ""); } catch (Exception e) { return ""; }
    }

    private class Ouvinte implements RecognitionListener {
        private String ultimo = "";
        @Override public void onPartialResult(String h) {
            String s = texto(h, "partial");
            if (!s.isEmpty() && !s.equals(ultimo)) { ultimo = s; emitSignal("parcial", s); }
        }
        @Override public void onResult(String h) {
            ultimo = "";
            emitSignal("ouviu", texto(h, "text"));
        }
        @Override public void onFinalResult(String h) {
            ultimo = "";
            String s = texto(h, "text");
            if (!s.isEmpty()) emitSignal("ouviu", s);
        }
        @Override public void onError(Exception e) { emitSignal("estado", "erro:" + e.getMessage()); }
        @Override public void onTimeout() { }
    }
}
