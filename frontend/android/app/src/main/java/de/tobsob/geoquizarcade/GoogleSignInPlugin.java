package de.tobsob.geoquizarcade;

import android.os.CancellationSignal;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/**
 * Google-Anmeldung über Androids Credential Manager (DESIGN-GOOGLE-NATIVE.md).
 *
 * Liefert nur das ID-Token an die Seite; das Einlösen bei Supabase
 * (signInWithIdToken / linkIdentity) passiert in authApi.ts. Kein Browser,
 * kein Rücksprung über das URL-Schema — die Kontoauswahl ist ein
 * System-Sheet über der App und zeigt den App-Namen statt der
 * Supabase-Domain.
 */
@CapacitorPlugin(name = "GoogleSignIn")
public class GoogleSignInPlugin extends Plugin {

    @PluginMethod
    public void signIn(final PluginCall call) {
        String serverClientId = call.getString("serverClientId");
        String nonce = call.getString("nonce");
        if (serverClientId == null || serverClientId.isEmpty()) {
            call.reject("serverClientId fehlt", "config");
            return;
        }

        // „Sign in with Google" statt GetGoogleIdOption: zeigt immer die
        // Kontoauswahl inkl. „Konto hinzufügen" — passend zu einem Button,
        // den der Nutzer bewusst drückt.
        GetSignInWithGoogleOption.Builder option = new GetSignInWithGoogleOption.Builder(serverClientId);
        if (nonce != null) {
            option.setNonce(nonce);
        }
        GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(option.build())
                .build();

        CredentialManager.create(getContext()).getCredentialAsync(
                getActivity(),
                request,
                new CancellationSignal(),
                ContextCompat.getMainExecutor(getContext()),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse response) {
                        Credential credential = response.getCredential();
                        if (credential instanceof CustomCredential
                                && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                                        .equals(credential.getType())) {
                            GoogleIdTokenCredential google =
                                    GoogleIdTokenCredential.createFrom(credential.getData());
                            JSObject result = new JSObject();
                            result.put("idToken", google.getIdToken());
                            call.resolve(result);
                        } else {
                            call.reject("Unerwarteter Credential-Typ: " + credential.getType(), "unexpected");
                        }
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException e) {
                        // Abbruch durch den Nutzer getrennt melden: Nur dann
                        // darf die Seite NICHT auf den Browser-Weg ausweichen.
                        String code = e instanceof GetCredentialCancellationException ? "canceled" : "failed";
                        call.reject(e.getType() + ": " + e.getMessage(), code);
                    }
                });
    }
}
