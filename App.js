import { StatusBar } from "expo-status-bar";
import { Platform, BackHandler, ToastAndroid } from "react-native";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useFonts } from "expo-font";
import * as NavigationBar from "expo-navigation-bar";
import { useEffect, useRef } from "react";
import { UserProvider } from "./config/UserContext";
import { auth } from "./config/firebase";
import { initNotifications } from "./config/reminders";
import { useLastNotificationResponse } from "expo-notifications";

import StartScreen from "./screens/StartScreen";
import Getstarted from "./screens/Getstarted";
import Login from "./screens/Login";
import Home from "./screens/Home";
import profile from "./screens/profile";
import chats from "./screens/chats";
import CollectionSchedule from "./screens/CollectionSchedule";
import Notification from "./screens/Notification";
import ComplaintFeedback from "./screens/ComplaintFeedback";
import SegregationGuide from "./screens/SegregationGuide";
import CleaningSchedule from "./screens/CleaningSchedule";
import RewardSystem from "./screens/RewardSystem";
import SignUp from "./screens/SignUp";
import AdminHome from "./screens/AdminHome";
import ManageUsers from "./screens/ManageUsers";
import ManageSchedules from "./screens/ManageSchedules";
import ViewComplaints from "./screens/ViewComplaints";
import QRGenerator from "./screens/QRGenerator";
import QRScanner from "./screens/QRScanner";
import ManageRewards from "./screens/ManageRewards";
import RedeemRewards from "./screens/RedeemRewards";
import CreateNotification from "./screens/CreateNotification";
import ManageAnnouncements from "./screens/ManageAnnouncements";
import DeveloperKiosk from "./screens/DeveloperKiosk";
import PointHistory from "./screens/PointHistory";

const Stack = createNativeStackNavigator();

function BackButtonHandler() {
  const lastPressRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        const now = Date.now();

        // Second press within 2 seconds -> logout and exit
        if (now - lastPressRef.current < 2000) {
          lastPressRef.current = 0;
          Promise.race([
            auth.signOut(),
            new Promise((resolve) => setTimeout(resolve, 1000)),
          ]).finally(() => BackHandler.exitApp());
          return true;
        }

        // First press -> ask to press again
        lastPressRef.current = now;
        ToastAndroid.show(
          "Press back again to log out and exit",
          ToastAndroid.LONG
        );
        return true;
      }
    );

    return () => subscription.remove();
  }, []);

  return null;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    RubikBurned: require("./assets/fonts/RubikBurned-Regular.ttf"),
  });

  const navigationRef = useNavigationContainerRef();
  const lastNotificationResponse = useLastNotificationResponse();

  // Reminder foundation: display handler + Android channel + permission.
  // Runs before any notification is ever scheduled.
  useEffect(() => {
    initNotifications();
  }, []);

  // Tap-through: opening a reminder lands on the collection schedule.
  // Retries briefly — a cold start may not have mounted the navigator
  // yet (fonts are still loading), so isReady() can be false at first.
  useEffect(() => {
    if (!lastNotificationResponse) return;

    const data = lastNotificationResponse.notification?.request?.content?.data;
    if (!data || !data.screen) return;

    let attempts = 0;
    let timer = setTimeout(function tick() {
      if (navigationRef.isReady()) {
        navigationRef.navigate(data.screen);
        return;
      }
      attempts += 1;
      if (attempts < 20) timer = setTimeout(tick, 500);
    }, 300);

    return () => clearTimeout(timer);
  }, [lastNotificationResponse]);

  if (!fontsLoaded) {
    return null;
  }

  if (Platform.OS === "android") {
    NavigationBar.setVisibilityAsync("hidden");
  }

  return (
    <UserProvider>
      <BackButtonHandler />
      <NavigationContainer ref={navigationRef}>
        <StatusBar hidden />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: "none",
          }}
        >
          <Stack.Screen name="Start" component={StartScreen} />
          <Stack.Screen name="Getstarted" component={Getstarted} />
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="Home" component={Home} />
          <Stack.Screen name="profile" component={profile} />
          <Stack.Screen name="chats" component={chats} />
          <Stack.Screen name="CollectionSchedule" component={CollectionSchedule} />
          <Stack.Screen name="Notification" component={Notification}/>
          <Stack.Screen name="ComplaintFeedback" component={ComplaintFeedback} />
          <Stack.Screen name="SegregationGuide" component={SegregationGuide} />
          <Stack.Screen name="CleaningSchedule" component={CleaningSchedule} />
          <Stack.Screen name="RewardSystem" component={RewardSystem} />
          <Stack.Screen name="SignUp" component={SignUp} />
          <Stack.Screen name="AdminHome" component={AdminHome} />
          <Stack.Screen name="ManageUsers" component={ManageUsers} />
          <Stack.Screen name="ManageSchedules" component={ManageSchedules} />
          <Stack.Screen name="ViewComplaints" component={ViewComplaints} />
          <Stack.Screen name="QRGenerator" component={QRGenerator} />
          <Stack.Screen name="QRScanner" component={QRScanner} />
          <Stack.Screen name="ManageRewards" component={ManageRewards} />
          <Stack.Screen name="RedeemRewards" component={RedeemRewards} />
          <Stack.Screen name="CreateNotification" component={CreateNotification} />
          <Stack.Screen name="ManageAnnouncements" component={ManageAnnouncements} />
          <Stack.Screen name="DeveloperKiosk" component={DeveloperKiosk} />
          <Stack.Screen name="PointHistory" component={PointHistory} />
        </Stack.Navigator>
      </NavigationContainer>
    </UserProvider>
  );
}