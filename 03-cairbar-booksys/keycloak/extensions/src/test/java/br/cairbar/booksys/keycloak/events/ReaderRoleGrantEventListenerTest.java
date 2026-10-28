package br.cairbar.booksys.keycloak.events;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.keycloak.events.Event;
import org.keycloak.events.EventType;
import org.keycloak.models.ClientModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.RealmProvider;
import org.keycloak.models.RoleModel;
import org.keycloak.models.UserModel;
import org.keycloak.models.UserProvider;

class ReaderRoleGrantEventListenerTest {

    private static final String REALM_ID = "realm-id";
    private static final String USER_ID = "user-id";

    private final KeycloakSession session = mock(KeycloakSession.class);
    private final RealmModel realm = mock(RealmModel.class);
    private final ClientModel apiClient = mock(ClientModel.class);
    private final RoleModel readerRole = mock(RoleModel.class);
    private final UserModel user = mock(UserModel.class);

    private ReaderRoleGrantEventListener listener;

    @BeforeEach
    void setUp() {
        RealmProvider realms = mock(RealmProvider.class);
        UserProvider users = mock(UserProvider.class);
        when(session.realms()).thenReturn(realms);
        when(session.users()).thenReturn(users);
        when(realms.getRealm(REALM_ID)).thenReturn(realm);
        when(users.getUserById(realm, USER_ID)).thenReturn(user);
        when(realm.getClientByClientId("booksys-api")).thenReturn(apiClient);
        when(apiClient.getRole("READER")).thenReturn(readerRole);
        when(user.isEnabled()).thenReturn(true);

        listener = new ReaderRoleGrantEventListener(session, new ReaderRoleTarget("booksys-api", "READER"));
    }

    @ParameterizedTest
    @EnumSource(value = EventType.class, names = {"VERIFY_EMAIL", "LOGIN"})
    void grantsReaderRoleOnceEmailIsVerified(EventType type) {
        when(user.isEmailVerified()).thenReturn(true);

        listener.onEvent(event(type));

        verify(user).grantRole(readerRole);
    }

    @Test
    void doesNotGrantReaderRoleWhileEmailIsPending() {
        when(user.isEmailVerified()).thenReturn(false);

        listener.onEvent(event(EventType.LOGIN));

        verify(user, never()).grantRole(readerRole);
    }

    @Test
    void doesNotGrantReaderRoleToDisabledAccount() {
        when(user.isEmailVerified()).thenReturn(true);
        when(user.isEnabled()).thenReturn(false);

        listener.onEvent(event(EventType.LOGIN));

        verify(user, never()).grantRole(readerRole);
    }

    @Test
    void isIdempotentWhenReaderRoleIsAlreadyGranted() {
        when(user.isEmailVerified()).thenReturn(true);
        when(user.hasDirectRole(readerRole)).thenReturn(true);

        listener.onEvent(event(EventType.LOGIN));

        verify(user, never()).grantRole(readerRole);
    }

    @Test
    void ignoresUnrelatedEvents() {
        when(user.isEmailVerified()).thenReturn(true);

        listener.onEvent(event(EventType.UPDATE_PROFILE));

        verify(user, never()).grantRole(readerRole);
    }

    @Test
    void ignoresRealmWithoutReaderRole() {
        when(user.isEmailVerified()).thenReturn(true);
        when(apiClient.getRole("READER")).thenReturn(null);

        listener.onEvent(event(EventType.LOGIN));

        verify(user, never()).grantRole(readerRole);
    }

    private static Event event(EventType type) {
        Event event = new Event();
        event.setType(type);
        event.setRealmId(REALM_ID);
        event.setUserId(USER_ID);
        return event;
    }
}
