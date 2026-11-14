package com.rcandrerc.voz;

import android.app.Activity;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;
import org.godotengine.godot.Godot;
import org.godotengine.godot.plugin.GodotPlugin;
import org.godotengine.godot.plugin.SignalInfo;
import org.godotengine.godot.plugin.UsedByGodot;

// Comando de voz (André 2026-11-14): só no celular e só com Configurações > Comando de voz ligado. Usa o
// reconhecedor de voz do próprio Android (de graça, no aparelho quando o pacote de voz está baixado) e escuta
// sem parar: cada frase ouvida vira o sinal "ouviu" com até 5 tentativas (uma por linha) e o jogo escolhe a que bate
// com um comando (voz.gd). Desligado, o microfone fica fechado e não gasta nada. Jogo em segundo plano: para de
// escutar e volta sozinho quando o jogo volta.
public class VozJogo extends GodotPlugin {
    private final Handler fila = new Handler(Looper.getMainLooper());
    private SpeechRecognizer rec;
    private boolean ativo = false, pausado = false, escutando = false, noAparelho = true, mudo = false;
    private String idioma = "pt-BR";
    private int erros = 0; // erros seguidos: espera mais antes de tentar de novo (sem internet não fica em laço quente)

    public VozJogo(Godot godot) { super(godot); }

    @Override public String getPluginName() { return "VozJogo"; }

    @Override public Set<SignalInfo> getPluginSignals() {
        Set<SignalInfo> s = new HashSet<>();
        s.add(new SignalInfo("ouviu", String.class));   // frase final: tentativas separadas por "\n"
        s.add(new SignalInfo("parcial", String.class)); // pedaço enquanto ainda fala (o jogo só usa para "parar")
        s.add(new SignalInfo("estado", String.class));  // "escutando", "sem_permissao", "sem_servico", "erro:N"
        return s;
    }

    @UsedByGodot
    public boolean disponivel() {
        Activity a = getActivity();
        return a != null && SpeechRecognizer.isRecognitionAvailable(a);
    }

    @UsedByGodot
    public void ligar(String lingua) {
        idioma = (lingua == null || lingua.isEmpty()) ? "pt-BR" : lingua;
        ativo = true;
        erros = 0;
        fila.post(this::comecar);
    }

    @UsedByGodot
    public void desligar() {
        ativo = false;
        fila.removeCallbacksAndMessages(null);
        fila.post(this::fechar);
    }

    @Override public void onMainPause() {
        pausado = true;
        fila.removeCallbacksAndMessages(null);
        fila.post(this::fechar);
    }

    @Override public void onMainResume() {
        pausado = false;
        if (ativo) fila.postDelayed(this::comecar, 300);
    }

    @Override public void onMainDestroy() { fila.post(this::fechar); }

    // o bip de "comecei a escutar" de alguns celulares toca a cada frase: abafa só os sons do sistema (não a música do jogo)
    private void abafar(boolean v) {
        Activity a = getActivity();
        if (a == null || mudo == v) return;
        try {
            AudioManager am = (AudioManager) a.getSystemService(Activity.AUDIO_SERVICE);
            int d = v ? AudioManager.ADJUST_MUTE : AudioManager.ADJUST_UNMUTE;
            am.adjustStreamVolume(AudioManager.STREAM_SYSTEM, d, 0);
            am.adjustStreamVolume(AudioManager.STREAM_NOTIFICATION, d, 0);
            mudo = v;
        } catch (Exception e) { /* sem acesso ao som do sistema (não perturbe): segue com o bip */ }
    }

    private void fechar() {
        escutando = false;
        if (rec != null) {
            try { rec.cancel(); rec.destroy(); } catch (Exception e) { }
            rec = null;
        }
        abafar(false);
    }

    private void criar(Activity a) {
        if (rec != null) return;
        if (noAparelho && Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(a)) {
            rec = SpeechRecognizer.createOnDeviceSpeechRecognizer(a);
        } else {
            noAparelho = false;
            rec = SpeechRecognizer.createSpeechRecognizer(a);
        }
        rec.setRecognitionListener(new Ouvinte());
    }

    private void comecar() {
        if (!ativo || pausado) return;
        Activity a = getActivity();
        if (a == null) return;
        if (!SpeechRecognizer.isRecognitionAvailable(a)) { emitSignal("estado", "sem_servico"); ativo = false; return; }
        try {
            criar(a);
            abafar(true);
            Intent it = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            it.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            it.putExtra(RecognizerIntent.EXTRA_LANGUAGE, idioma);
            it.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
            it.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            it.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
            it.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, a.getPackageName());
            // comandos são curtos: fecha a frase logo depois que a pessoa para de falar
            it.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 700);
            it.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 500);
            escutando = true;
            rec.startListening(it);
        } catch (Exception e) {
            escutando = false;
            de_novo(1000);
        }
    }

    private void de_novo(long ms) {
        if (!ativo || pausado) return;
        fila.removeCallbacksAndMessages(null);
        fila.postDelayed(this::comecar, ms);
    }

    private static String juntar(Bundle b) {
        if (b == null) return "";
        ArrayList<String> l = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (l == null || l.isEmpty()) return "";
        return String.join("\n", l);
    }

    private class Ouvinte implements RecognitionListener {
        @Override public void onReadyForSpeech(Bundle p) { emitSignal("estado", "escutando"); }
        @Override public void onBeginningOfSpeech() { }
        @Override public void onRmsChanged(float v) { }
        @Override public void onBufferReceived(byte[] b) { }
        @Override public void onEndOfSpeech() { }
        @Override public void onEvent(int t, Bundle p) { }

        @Override public void onPartialResults(Bundle b) {
            String s = juntar(b);
            if (!s.isEmpty()) emitSignal("parcial", s);
        }

        @Override public void onResults(Bundle b) {
            escutando = false;
            erros = 0;
            String s = juntar(b);
            if (!s.isEmpty()) emitSignal("ouviu", s);
            de_novo(60);
        }

        @Override public void onError(int e) {
            escutando = false;
            switch (e) {
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                    ativo = false;
                    fechar();
                    emitSignal("estado", "sem_permissao");
                    return;
                case SpeechRecognizer.ERROR_NO_MATCH:
                case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                    erros = 0;
                    de_novo(60); // silêncio ou barulho sem palavra: só volta a escutar
                    return;
                case 12: // ERROR_LANGUAGE_NOT_SUPPORTED
                case 13: // ERROR_LANGUAGE_UNAVAILABLE (pacote de voz não baixado): usa o reconhecedor comum
                    if (noAparelho) {
                        noAparelho = false;
                        fechar();
                        abafar(true);
                        de_novo(100);
                        return;
                    }
                    break;
                case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                case SpeechRecognizer.ERROR_CLIENT:
                    fechar(); // recria do zero
                    break;
                default:
                    break;
            }
            erros++;
            emitSignal("estado", "erro:" + e);
            de_novo(Math.min(5000, 300L * erros * erros));
        }
    }
}
