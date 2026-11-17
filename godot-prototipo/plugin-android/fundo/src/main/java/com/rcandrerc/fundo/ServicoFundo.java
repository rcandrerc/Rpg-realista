package com.rcandrerc.fundo;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

/** Serviço na frente enquanto o jogo está no fundo (FundoJogo). Não faz nada além de segurar o app vivo. */
public class ServicoFundo extends Service {
    static final long MAX_MS = 10 * 60 * 1000L; // depois disso o Android pode fechar o jogo como antes
    private static final String CANAL = "fundo";
    private static final int ID = 7301;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable parar = this::stopSelf;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            Notification n = aviso();
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(ID, n);
            }
        } catch (Throwable e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        handler.removeCallbacks(parar);
        handler.postDelayed(parar, MAX_MS);
        return START_NOT_STICKY;
    }

    private Notification aviso() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (nm != null && nm.getNotificationChannel(CANAL) == null) {
                NotificationChannel c = new NotificationChannel(CANAL, "Jogo aberto", NotificationManager.IMPORTANCE_MIN);
                c.setShowBadge(false);
                nm.createNotificationChannel(c);
            }
            b = new Notification.Builder(this, CANAL);
        } else {
            b = new Notification.Builder(this);
        }
        Intent abrir = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (abrir != null) {
            abrir.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            b.setContentIntent(PendingIntent.getActivity(this, 0, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        }
        return b.setSmallIcon(getApplicationInfo().icon)
                .setContentTitle("Age of Embers")
                .setContentText("A partida continua aberta. Toque para voltar.")
                .setOngoing(true)
                .build();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(parar);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
