import { FcGoogle } from "react-icons/fc";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  User,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  useLocation,
  Navigate,
  NavigateFunction,
  useNavigate,
  Location,
} from "react-router-dom";
import { auth } from "../../firebase";
import { getDoc } from "firebase/firestore";
import { docRef } from "~/firestore.service";
import { CURRENT_USER$ } from "~/services/user.service";
import { onlyCallFnOnceWhilePreviousCallIsPending } from "~/utils/onlyCallOnceWhilePending";
import { ComponentType } from "react";
import { useObservable } from "~/utils/useObservable";
import { setIsLoading } from "~/services/loading.service";
import { Helmet } from "react-helmet-async";
import {
  NewUserDialog,
  NewUserDialogState,
} from "~/dialogs/user-new/NewUserDialog";
import { useServerAPIVersion } from "~/services/version.service";
import { LoadingText } from "~/components/LoadingText";

export const LoginView: ComponentType<{}> = () => {
  const currentUser = useObservable(() => CURRENT_USER$, {
    initialValue: "loading" as const,
  });

  const apiVersion = useServerAPIVersion();

  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = attemptToGetRedirectLocation(location);

  // undefined if we haven't yet ascertained the current auth status
  if (currentUser === "loading" || apiVersion === "loading") {
    return <LoadingText />;
  }

  if (!apiVersion.matches) {
    return <Navigate to={"/maintenance"} state={{ from: location }} replace />;
  }

  if (currentUser) {
    return <Navigate to={redirectTo || "/inbox"} replace />;
  }

  return (
    <div className="flex justify-center items-center min-h-screen flex-col space-y-10">
      <Helmet>
        <title>Login | Comms</title>
      </Helmet>

      <NewUserDialog />

      <h1 className="text-4xl font-bold">Login to Comms</h1>

      <button
        className="flex rounded-md px-8 py-4 bg-tealDark-6 text-white items-center space-x-3"
        onClick={() => signinWithGoogle(navigate, redirectTo)}
      >
        <FcGoogle /> <span>Login with Google</span>
      </button>
    </div>
  );
};

const signinWithGoogle = onlyCallFnOnceWhilePreviousCallIsPending(
  setIsLoading(async (navigate: NavigateFunction, redirectTo?: Location) => {
    // Set language to the default browser preference
    auth.useDeviceLanguage();

    let user: User | null;

    if (
      import.meta.env.VITE_FIREBASE_EMULATORS === "true" &&
      !navigator.onLine
    ) {
      // We don't use the `signInWithPopup` method in the emulator
      // since it tries to fetch the `gapi` API asyncronously and will
      // error when offline.
      const email = prompt(
        "Choose an email address",
        "olive.grass@example.com",
      );

      if (!email) return;

      const password = "password";

      user = await signInWithEmailAndPassword(auth, email, password)
        .catch((e) => {
          if (e.code === "auth/user-not-found") {
            return createUserWithEmailAndPassword(auth, email, password);
          }

          throw e;
        })
        .then((c) => c.user)
        .catch((e) => {
          console.warn(JSON.stringify(e));
          console.warn(e);
          return null;
        });
    } else {
      user = await signInWithPopup(auth, new GoogleAuthProvider())
        .then((c) => c.user)
        .catch((e) => {
          console.warn(e);
          return null;
        });
    }

    if (!user) return;

    const userSnap = await getDoc(docRef("users", user.uid));

    if (userSnap.exists()) {
      navigate(redirectTo || "/inbox", { replace: true });
      return;
    }

    NewUserDialogState.toggle(true, {
      name: user.displayName,
      email: user.email,
    });
  }),
);

/**
 * If the user was attempting to navigate to a protected page in
 * our app, the `withAuthGuard` wrapper would redirect them to
 * the login page but save the location they were attempting to
 * navigate to in `location.state.from`.
 */
function attemptToGetRedirectLocation({ state }: Location) {
  if (typeof state !== "object" || !state) return;

  const { from } = state as { from?: Location };

  return from;
}
