package com.rcandrerc.fundo;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import org.godotengine.godot.Godot;
import org.godotengine.godot.plugin.GodotPlugin;
import org.godotengine.godot.plugin.UsedByGodot;

/**
 * Voltar do segundo plano (André 2026-11-17: "só de pôr em segundo plano, quando volta, pesquisa atualização e conecta
 * de novo, 40 s"). O jogo ocupa muita memória e o Android fechava o app no fundo em poucos minutos; voltar era abrir do
 * zero. Quando o jogo sai da tela, liga o ServicoFundo (serviço na frente, com aviso na barra): o Android trata o app
 * como em uso e não fecha. Quando o jogo volta para a tela, desliga. O serviço se desliga sozinho depois de
 * ServicoFundo.MAX_MS no fundo.
 */
public class FundoJogo extends GodotPlugin {
    private static final String TAG = "FundoJogo";
    private boolean ativo = true; // o jogo pode desligar (ligar(false)), por exemplo na tela de login
    private boolean ligado = false;
    private int vezes = 0; // quantas vezes o serviço foi ligado nesta abertura (registro da entrada)
    private String erro = "";

    public FundoJogo(Godot godot) {
        super(godot);
    }

    @Override
    public String getPluginName() {
        return "FundoJogo";
    }

    @Override
    public void onMainPause() {
        if (ativo) ligarServico();
    }

    @Override
    public void onMainResume() {
        desligarServico();
    }

    /**
     * App fechando de vez (André 2026-11-21: "toda primeira abertura dá erro e fecha", POCO Android 16). Antes deste
     * plugin o Android matava o processo do jogo no fundo sem cerimônia. Com o serviço segurando o processo vivo, quem
     * fecha passou a ser o próprio Godot: depois deste aviso ele desliga o motor na linha de desenho
     * (VkRenderer.onRenderThreadExiting -> GodotLib.ondestroy), e é ali que o libgodot_android.so cai. O Android mostra
     * "fechou forçadamente" e o toque no ícone seguinte já pega o app no meio da queda.
     * O progresso já foi gravado na pausa (main.gd, NOTIFICATION_APPLICATION_PAUSED), que sempre vem antes daqui.
     * Então fecha o processo agora, do mesmo jeito que o Android fazia antes e que o próprio Godot faz no fim
     * (ProcessPhoenix.forceQuit), sem passar pela descida do motor que cai.
     */
    @Override
    public void onMainDestroy() {
        desligarServico();
        Log.i(TAG, "jogo fechando: encerra o processo sem descer o motor");
        android.os.Process.killProcess(android.os.Process.myPid());
    }

    @UsedByGodot
    public void ligar(boolean sim) {
        ativo = sim;
    }

    @UsedByGodot
    public int vezes() {
        return vezes;
    }

    @UsedByGodot
    public String erro() {
        return erro;
    }

    private void ligarServico() {
        Activity act = getActivity();
        if (act == null) return;
        try {
            Intent it = new Intent(act, ServicoFundo.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) act.startForegroundService(it);
            else act.startService(it);
            ligado = true;
            vezes++;
        } catch (Throwable e) { // Android 12+ pode recusar (app já no fundo): o jogo segue como antes
            erro = e.getClass().getSimpleName();
            Log.w(TAG, "não ligou o serviço", e);
        }
    }

    private void desligarServico() {
        if (!ligado) return;
        ligado = false;
        Activity act = getActivity();
        if (act == null) return;
        try {
            act.stopService(new Intent(act, ServicoFundo.class));
        } catch (Throwable e) {
            Log.w(TAG, "não desligou o serviço", e);
        }
    }
}
