import { useTexture } from "@react-three/drei";
import { Component, type ReactNode, useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";

interface PlayerMatProps {
  imagePath: string;
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
}

interface PlayerMatErrorBoundaryProps {
  children: ReactNode;
  fallbackProps: PlayerMatProps;
}

interface PlayerMatErrorBoundaryState {
  hasError: boolean;
}

function FallbackPlayerMat({ position, rotationY = 0, width = 3, height = 1.5 }: PlayerMatProps) {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, rotationY]} position={position}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color="#252832" roughness={0.9} metalness={0} />
    </mesh>
  );
}

class PlayerMatErrorBoundary extends Component<PlayerMatErrorBoundaryProps, PlayerMatErrorBoundaryState> {
  state: PlayerMatErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PlayerMatErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    console.warn(`[PlayerMat] Missing mat asset: ${this.props.fallbackProps.imagePath}. Using a plain fallback.`);
  }

  render() {
    return this.state.hasError
      ? <FallbackPlayerMat {...this.props.fallbackProps} />
      : this.props.children;
  }
}

function TexturedPlayerMat({ imagePath, position, rotationY = 0, width = 3, height = 1.5 }: PlayerMatProps) {
  const texture = useTexture(imagePath);
  const { gl } = useThree();
  const configuredTexture = useMemo(() => {
    const next = texture.clone();
    next.anisotropy = gl.capabilities.getMaxAnisotropy();
    next.needsUpdate = true;
    return next;
  }, [texture, gl]);

  useEffect(() => {
    return () => configuredTexture.dispose();
  }, [configuredTexture]);

  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, rotationY]} position={position}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={configuredTexture} roughness={0.75} metalness={0.05} />
    </mesh>
  );
}

export function PlayerMat(props: PlayerMatProps) {
  return (
    <PlayerMatErrorBoundary fallbackProps={props}>
      <TexturedPlayerMat {...props} />
    </PlayerMatErrorBoundary>
  );
}
