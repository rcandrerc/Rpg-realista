package com.rcandrerc.logingoogle;

import android.app.Activity;
import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.Executors;
import org.godotengine.godot.Godot;
import org.godotengine.godot.plugin.GodotPlugin;
import org.godotengine.godot.plugin.SignalInfo;
import org.godotengine.godot.plugin.UsedByGodot;

// Login com Google dentro do app: abre a janela do próprio Google (Credential Manager) e devolve o crachá (ID token)
// para o jogo mandar ao servidor (/conta/entrar), igual ao site. O crachá é para o Client ID da web (o servidor confere).
public class LoginGoogle extends GodotPlugin {
    public LoginGoogle(Godot godot) { super(godot); }

    @NonNull @Override public String getPluginName() { return "LoginGoogle"; }

    @NonNull @Override public Set<SignalInfo> getPluginSignals() {
        Set<SignalInfo> s = new HashSet<>();
        s.add(new SignalInfo("login_ok", String.class, String.class));
        s.add(new SignalInfo("login_erro", String.class));
        return s;
    }

    @UsedByGodot
    public void entrar(String clientIdWeb) {
        Activity a = getActivity();
        if (a == null) { emitSignal("login_erro", "sem tela"); return; }
        GetSignInWithGoogleOption opcao = new GetSignInWithGoogleOption.Builder(clientIdWeb).build();
        GetCredentialRequest pedido = new GetCredentialRequest.Builder().addCredentialOption(opcao).build();
        a.runOnUiThread(() -> CredentialManager.Companion.create(a).getCredentialAsync(a, pedido, new CancellationSignal(),
            Executors.newSingleThreadExecutor(), new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override public void onResult(GetCredentialResponse r) {
                    Credential c = r.getCredential();
                    if (c instanceof CustomCredential && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) {
                        GoogleIdTokenCredential g = GoogleIdTokenCredential.createFrom(c.getData());
                        String nome = g.getGivenName() != null ? g.getGivenName() : "";
                        emitSignal("login_ok", g.getIdToken(), nome);
                    } else emitSignal("login_erro", "resposta inesperada");
                }
                @Override public void onError(@NonNull GetCredentialException e) {
                    emitSignal("login_erro", e instanceof GetCredentialCancellationException ? "cancelado" : e.getType() + ": " + e.getMessage());
                }
            }));
    }

    // Sair da conta: esquece a escolha, para a janela perguntar de novo da próxima vez
    @UsedByGodot
    public void sair() {
        Activity a = getActivity(); if (a == null) return;
        CredentialManager.Companion.create(a).clearCredentialStateAsync(new ClearCredentialStateRequest(), new CancellationSignal(),
            Executors.newSingleThreadExecutor(), new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override public void onResult(Void v) {}
                @Override public void onError(@NonNull ClearCredentialException e) {}
            });
    }
}
