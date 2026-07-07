import { Text, View } from "react-native";
import { surface, ink } from "../../constants/colors";
import { fonts } from "../../constants/typography";

export default function ProfileScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: surface.cream, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: fonts.body, fontSize: 16, color: ink[500] }}>Coming soon</Text>
    </View>
  );
}
