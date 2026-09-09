package com.weadk.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The spec is the contract with the frontend: it is generated from these
 * controllers and compiled into TypeScript, so a shape that changes here fails
 * the frontend build rather than a user's afternoon.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI weAdkOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("WE-ADK API")
                        .version("0.1.0")
                        .description("Projects, meetings, generated screens, and the requests they become.")
                        .license(new License().name("Proprietary")));
    }
}
