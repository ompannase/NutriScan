import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Body, Card, EmptyState, ErrorState, Input, Loading, ScreenTitle } from "@/components/ui";
import { productService } from "@/services/product";
import { friendlyError } from "@/utils/errors";

export default function SearchScreen() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 400);
    return () => clearTimeout(timer);
  }, [input]);
  const result = useQuery({
    queryKey: ["product-search", query],
    queryFn: ({ signal }) => productService.search(query, signal),
    enabled: query.length >= 2,
  });
  return <AppScreen>
    <ScreenTitle>Search products</ScreenTitle>
    <Input label="Product or brand" value={input} autoFocus onChangeText={setInput} returnKeyType="search" />
    {result.isLoading ? <Loading /> : result.error ? <ErrorState message={friendlyError(result.error)} retry={() => void result.refetch()} /> : !query ? <EmptyState title="Search Open Food Facts" message="Enter at least two characters. Results are cached after you open a product." /> : result.data?.length ? <View style={styles.list}>{result.data.map((product) => <Pressable accessibilityRole="button" accessibilityLabel={`Open ${product.name}`} key={product.id} onPress={() => product.barcode && router.push(`/product/${product.barcode}`)}><Card><Body>{product.name}</Body><Body muted>{product.brand ?? "Brand not available"}</Body></Card></Pressable>)}</View> : <EmptyState title="No matching products" message="Try another term, scan a label, or add a custom product." />}
  </AppScreen>;
}
const styles = StyleSheet.create({ list: { gap: 10 } });
